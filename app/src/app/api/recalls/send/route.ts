import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, RecallStatus } from "@prisma/client";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

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
    const [lastAppointments, lastRecalls, pendingRecalls] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: ["patientId"],
        where: {
          serviceType: rule.serviceType,
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

    const lastRecallByPatient = new Map(
      lastRecalls
        .map((entry) => [entry.patientId, entry._max?.dueAt ?? null] as const)
        .filter((entry): entry is [string, Date] => Boolean(entry[1])),
    );
    const pendingRecallByPatient = new Map(
      pendingRecalls
        .map((entry) => [entry.patientId, entry._max?.dueAt ?? null] as const)
        .filter((entry): entry is [string, Date] => Boolean(entry[1])),
    );

    const pendingCreates = lastAppointments
      .map((entry) => {
        const lastVisit = entry._max?.startsAt ?? null;
        if (!lastVisit) return null;
        const pendingRecallDueAt = pendingRecallByPatient.get(entry.patientId);
        if (pendingRecallDueAt) {
          return null;
        }

        const lastRecallDueAt = lastRecallByPatient.get(entry.patientId);
        let nextDueAt = addDays(lastVisit, rule.intervalDays);

        if (lastRecallDueAt && lastRecallDueAt >= lastVisit) {
          nextDueAt = addDays(lastRecallDueAt, rule.intervalDays);
        }

        if (nextDueAt < now) {
          nextDueAt = now;
        }

        if (nextDueAt > horizon) return null;

        return {
          patientId: entry.patientId,
          ruleId: rule.id,
          dueAt: nextDueAt,
          status: RecallStatus.PENDING,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    if (pendingCreates.length > 0) {
      await prisma.recall.createMany({ data: pendingCreates });
    }
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  await enqueueRecurringRecalls(now);
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
    const rule = recall.rule as any;
    const subject = rule?.emailSubject ?? `Promemoria ${rule?.serviceType ?? ""}`;
    const body =
      rule?.message ??
      `Gentile ${patient.firstName ?? patient.lastName ?? "paziente"}, promemoria per ${rule.serviceType}.`;

    const channel = rule?.channel ?? "EMAIL";
    const wantsEmail = channel === "EMAIL" || channel === "BOTH";
    const wantsSms = channel === "SMS" || channel === "BOTH";

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

  return NextResponse.json({ processed: dueRecalls.length });
}
