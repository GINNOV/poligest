import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, RecallStatus } from "@prisma/client";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { getEmailTemplateByName } from "@/lib/email-templates";
import { errorResponse } from "@/lib/error-response";
import { autoCompletePastAppointments } from "@/lib/appointments/status-automation";
import {
  buildAppointmentReminderDeliveryPlan,
  buildRecallDeliveryPlan,
  computeAppointmentReminderCreates,
  computeRecurringRecallCreates,
  shouldSkipAppointmentReminder,
} from "@/lib/recalls/send-domain";
import { sendPracticeWeeklyReport } from "@/lib/practice-weekly-report";
import { getPracticeTimeZone } from "@/lib/practice-settings";

const HORIZON_DAYS = 30;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function enqueueRecurringRecalls(now: Date) {
  const horizon = addDays(now, HORIZON_DAYS);
  const rules = await prisma.recallRule.findMany();

  for (const rule of rules) {
    const ruleServiceType = rule.serviceType === "ANY" ? null : rule.serviceType;
    const [lastAppointments, lastRecalls, pendingRecalls] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: ["patientId"],
        where: {
          ...(ruleServiceType ? { serviceType: ruleServiceType } : {}),
          startsAt: { lte: now },
          status: AppointmentStatus.COMPLETED,
        },
        orderBy: {
          patientId: "asc",
        },
        _max: { startsAt: true },
      }),
      prisma.recall.groupBy({
        by: ["patientId"],
        where: { ruleId: rule.id },
        orderBy: {
          patientId: "asc",
        },
        _max: { dueAt: true },
      }),
      prisma.recall.groupBy({
        by: ["patientId"],
        where: { ruleId: rule.id, status: RecallStatus.PENDING },
        orderBy: {
          patientId: "asc",
        },
        _max: { dueAt: true },
      }),
    ]);

    const pendingCreates = computeRecurringRecallCreates({
      now,
      horizon,
      rule: { id: rule.id, intervalDays: rule.intervalDays },
      lastAppointments,
      lastRecalls,
      pendingRecalls,
    });

    if (pendingCreates.length > 0) {
      await prisma.recall.createMany({ data: pendingCreates });
    }
  }
}

async function enqueueAppointmentReminders(now: Date, timeZone: string) {
  const horizon = addDays(now, HORIZON_DAYS);
  const rule = await prisma.appointmentReminderRule.findFirst({ where: { enabled: true } });
  if (!rule) return;

  const timingType = rule.timingType === "DAYS_BEFORE" ? "DAYS_BEFORE" : "SAME_DAY_TIME";
  const timeOfDayMinutes = typeof rule.timeOfDayMinutes === "number" ? rule.timeOfDayMinutes : 540;
  const upperBound = timingType === "DAYS_BEFORE" ? addDays(horizon, rule.daysBefore) : horizon;
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gt: now, lte: upperBound },
      status: { in: [AppointmentStatus.TO_CONFIRM, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_WAITING, AppointmentStatus.IN_PROGRESS] },
    },
    select: { id: true, patientId: true, startsAt: true, status: true },
  });

  const pendingCreates = computeAppointmentReminderCreates({
    now,
    horizon,
    timeZone,
    rule: { id: rule.id, daysBefore: rule.daysBefore, timingType, timeOfDayMinutes },
    appointments: upcomingAppointments,
  });

  if (pendingCreates.length > 0) {
    await prisma.appointmentReminder.createMany({ data: pendingCreates, skipDuplicates: true });
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get("x-cron-secret");
  if (!secret || providedSecret !== secret) {
    return errorResponse({
      message: "Unauthorized",
      status: 401,
      source: "recalls_send",
      path: new URL(req.url).pathname,
    });
  }

  try {
    const now = new Date();
    const timeZone = await getPracticeTimeZone();
    let weeklyReport: Awaited<ReturnType<typeof sendPracticeWeeklyReport>> | null = null;
    const autoCompletedAppointments = await autoCompletePastAppointments(now);

    try {
      weeklyReport = await sendPracticeWeeklyReport({ now, trigger: "CRON", timeZone, syncAppointments: false });
    } catch (err) {
      console.error("[practice_weekly_report] failed during recalls cron", { err });
    }

    await enqueueRecurringRecalls(now);
    await enqueueAppointmentReminders(now, timeZone);
    const dueRecalls = await prisma.recall.findMany({
      where: { status: RecallStatus.PENDING, dueAt: { lte: now } },
      include: {
        patient: { select: { email: true, phone: true, firstName: true, lastName: true } },
        rule: true,
      },
      take: 50,
    });

    for (const recall of dueRecalls) {
      const patient = recall.patient;
      const rule = recall.rule as {
        serviceType?: string | null;
        templateName?: string | null;
        emailSubject?: string | null;
        message?: string | null;
        channel?: "EMAIL" | "SMS" | "BOTH" | null;
      };
      const templateName = rule.templateName ?? null;
      const template = templateName ? await getEmailTemplateByName(templateName) : null;
      const { subject, body, wantsEmail, wantsSms } = buildRecallDeliveryPlan({
        patient,
        rule,
        template,
      });

      let delivered = false;
      let attempted = false;

      if (wantsEmail) {
        attempted = true;
        if (patient.email) {
          try {
            await sendEmail(patient.email, subject, body);
            delivered = true;
          } catch (err) {
            console.error("[recalls] email failed", { recallId: recall.id, err });
          }
        }
      }

      if (wantsSms) {
        attempted = true;
        if (patient.phone) {
          try {
            await sendSms({
              to: patient.phone,
              body,
              patientId: recall.patientId,
            });
            delivered = true;
          } catch (err) {
            console.error("[recalls] sms failed", { recallId: recall.id, err });
          }
        }
      }

      if (attempted) {
        await prisma.recall.update({
          where: { id: recall.id },
          data: {
            status: delivered ? RecallStatus.CONTACTED : RecallStatus.SKIPPED,
            lastContactAt: new Date(),
          },
        });
      }
    }

    const dueAppointmentReminders = await prisma.appointmentReminder.findMany({
      where: { status: RecallStatus.PENDING, dueAt: { lte: now } },
      include: {
        patient: { select: { email: true, phone: true, firstName: true, lastName: true } },
        appointment: { select: { startsAt: true, status: true, doctor: { select: { fullName: true } } } },
        rule: true,
      },
      take: 50,
    });

    for (const reminder of dueAppointmentReminders) {
      const patient = reminder.patient;
      const rule = reminder.rule;
      const appointment = reminder.appointment;
      if (shouldSkipAppointmentReminder(now, appointment)) {
        await prisma.appointmentReminder.update({
          where: { id: reminder.id },
          data: { status: RecallStatus.SKIPPED, lastContactAt: new Date() },
        });
        continue;
      }
      const reminderExtras = rule as unknown as { templateName?: string | null };
      const templateName = reminderExtras.templateName ?? "appointment-reminder";
      const template = await getEmailTemplateByName(templateName);
      const { subject, body, wantsEmail, wantsSms } = buildAppointmentReminderDeliveryPlan({
        patient,
        appointment,
        timeZone,
        rule,
        template,
      });

      let delivered = false;
      let attempted = false;

      if (wantsEmail) {
        attempted = true;
        if (patient.email) {
          try {
            await sendEmail(patient.email, subject, body);
            delivered = true;
          } catch (err) {
            console.error("[appointment_reminders] email failed", { reminderId: reminder.id, err });
          }
        }
      }

      if (wantsSms) {
        attempted = true;
        if (patient.phone) {
          try {
            await sendSms({
              to: patient.phone,
              body,
              patientId: reminder.patientId,
            });
            delivered = true;
          } catch (err) {
            console.error("[appointment_reminders] sms failed", { reminderId: reminder.id, err });
          }
        }
      }

      if (attempted) {
        await prisma.appointmentReminder.update({
          where: { id: reminder.id },
          data: {
            status: delivered ? RecallStatus.CONTACTED : RecallStatus.SKIPPED,
            lastContactAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      autoCompletedAppointments,
      processed: dueRecalls.length,
      appointmentReminders: dueAppointmentReminders.length,
      weeklyReport,
    });
  } catch (error) {
    return errorResponse({
      message: "Errore invio richiami",
      status: 500,
      source: "recalls_send",
      path: new URL(req.url).pathname,
      error,
    });
  }
}
