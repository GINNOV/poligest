import { AppointmentStatus, RecurringMessageStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailWithHtml } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import { 
  formatDateInDisplayTimeZone, 
  formatDateInputValueInTimeZone, 
  parseDateAtMidnightInTimeZone,
  formatTimeInputValueInTimeZone
} from "@/lib/user-display-time-zone";

export const DAILY_REMINDER_CONFIG_ID = "default";

export type DailyReminderResult =
  | {
      status: "completed";
      results: Array<{
        userId: string;
        email: string;
        count: number;
        status: "sent" | "failed";
        error?: string;
      }>;
    }
  | {
      status: "skipped";
      reason: string;
    };

export async function sendDailyReminders(params?: {
  now?: Date;
  force?: boolean;
  timeZone?: string;
  trigger?: "CRON" | "MANUAL" | "API";
  actor?: { id: string; role: Role } | null;
}) {
  const now = params?.now ?? new Date();
  const timeZone = params?.timeZone ?? DEFAULT_PRACTICE_TIME_ZONE;
  const force = params?.force ?? false;
  const trigger = params?.trigger ?? "CRON";
  const actor = params?.actor ?? null;

  const config = await prisma.dailyReminderConfig.findUnique({
    where: { id: DAILY_REMINDER_CONFIG_ID },
  });

  const isEnabled = config ? config.enabled : true;
  const targetRoles = config?.targetRoles ?? [Role.ADMIN, Role.MANAGER, Role.ASSISTANT, Role.SECRETARY];

  if (!isEnabled && !force) {
    return { status: "skipped", reason: "disabled" } satisfies DailyReminderResult;
  }

  // Calculate target date (tomorrow)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const targetDateStr = formatDateInputValueInTimeZone(tomorrow, timeZone);
  const targetDateMidnight = parseDateAtMidnightInTimeZone(targetDateStr, timeZone);
  const targetDateEnd = new Date(targetDateMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Fetch staff users with associated Doctor profiles
  const usersWithDoctor = await prisma.user.findMany({
    where: {
      role: { in: targetRoles },
      isActive: true,
      email: { not: "" },
      doctor: { isNot: null },
    },
    include: {
      doctor: true,
    },
  });

  const results: Array<{ userId: string; email: string; count: number; status: "sent" | "failed"; error?: string }> = [];

  for (const user of usersWithDoctor) {
    if (!user.doctor) continue;

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: user.doctor.id,
        startsAt: {
          gte: targetDateMidnight,
          lte: targetDateEnd,
        },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      orderBy: { startsAt: "asc" },
      include: {
        patient: true,
      },
    });

    if (appointments.length === 0) continue;

    // Check if already sent for this specific user/date
    if (!force) {
      const existing = await prisma.dailyReminderLog.findFirst({
        where: {
          userId: user.id,
          date: targetDateMidnight,
          status: RecurringMessageStatus.SENT,
        },
      });
      if (existing) continue;
    }

    const subject = `Promemoria Appuntamenti · ${formatDateInDisplayTimeZone(targetDateMidnight, { dateStyle: "long" }, timeZone)}`;
    const { text, html } = generateDailyReminderContent(user, appointments, targetDateMidnight, timeZone);

    try {
      await sendEmailWithHtml(user.email, subject, text, html);
      await prisma.dailyReminderLog.create({
        data: {
          userId: user.id,
          date: targetDateMidnight,
          status: RecurringMessageStatus.SENT,
          sentAt: new Date(),
        },
      });
      results.push({ userId: user.id, email: user.email, count: appointments.length, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.dailyReminderLog.create({
        data: {
          userId: user.id,
          date: targetDateMidnight,
          status: RecurringMessageStatus.FAILED,
          error: message,
        },
      });
      results.push({ userId: user.id, email: user.email, count: appointments.length, status: "failed", error: message });
    }
  }

  if (results.length > 0) {
    await logAudit(actor, {
      action: "notifications.daily_reminder_sent",
      entity: "System",
      metadata: {
        trigger,
        recipientCount: results.filter((r) => r.status === "sent").length,
        targetDate: targetDateStr,
      },
    });
  }

  return { status: "completed", results } satisfies DailyReminderResult;
}

export type DailyReminderPreviewResult = 
  | { status: "success"; subject: string; text: string; html: string; count: number }
  | { status: "no_doctor"; message: string };

export async function generateDailyReminderPreview(userId: string, targetDate: Date, timeZone: string): Promise<DailyReminderPreviewResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { doctor: true },
  });

  if (!user) {
    return { status: "no_doctor", message: "Utente non trovato." };
  }

  if (!user.doctor) {
    return { status: "no_doctor", message: "L'utente non ha un profilo medico associato." };
  }

  const dateStr = formatDateInputValueInTimeZone(targetDate, timeZone);
  const targetDateMidnight = parseDateAtMidnightInTimeZone(dateStr, timeZone);
  const targetDateEnd = new Date(targetDateMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: user.doctor.id,
      startsAt: {
        gte: targetDateMidnight,
        lte: targetDateEnd,
      },
      status: {
        notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      },
    },
    orderBy: { startsAt: "asc" },
    include: {
      patient: true,
    },
  });

  const subject = `Promemoria Appuntamenti · ${formatDateInDisplayTimeZone(targetDateMidnight, { dateStyle: "long" }, timeZone)}`;
  const { text, html } = generateDailyReminderContent(user, appointments, targetDateMidnight, timeZone);

  return { status: "success", subject, text, html, count: appointments.length };
}

export function generateDailyReminderContent(user: any, appointments: any[], date: Date, timeZone: string) {
  const dateLabel = formatDateInDisplayTimeZone(date, { dateStyle: "full" }, timeZone);
  const rows = appointments.map((appt) => {
    const time = formatTimeInputValueInTimeZone(appt.startsAt, timeZone);
    const patientName = `${appt.patient.lastName} ${appt.patient.firstName}`;
    const notes = appt.notes?.trim() ? appt.notes : "Nessuna nota.";
    return { time, patientName, notes };
  });

  const text = [
    `Ciao ${user.name || user.email},`,
    `Ecco i tuoi appuntamenti per ${dateLabel}:`,
    "",
    ...rows.map((r) => `${r.time} - ${r.patientName}\nNote: ${r.notes}\n`),
    "",
    "Buon lavoro!",
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #18181b; line-height: 1.5;">
      <div style="background-color: #047857; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Agenda di Domani</h1>
        <p style="color: #d1fae5; margin: 5px 0 0; font-size: 14px;">${dateLabel}</p>
      </div>
      <div style="padding: 20px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Ciao <strong>${user.name || user.email}</strong>, ecco il riepilogo dei tuoi appuntamenti:</p>
        
        <div style="margin-top: 25px;">
          ${rows
            .map(
              (r) => `
            <div style="padding: 15px; border: 1px solid #f4f4f5; background-color: #fafafa; border-radius: 8px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="font-size: 16px; font-weight: 700; color: #047857;">${r.time}</span>
                <span style="font-size: 14px; font-weight: 600;">${r.patientName}</span>
              </div>
              <div style="font-size: 13px; color: #52525b; border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px;">
                <strong>Note:</strong> <span style="font-style: italic;">${r.notes}</span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>

        <p style="margin-top: 30px; font-size: 13px; color: #71717a; text-align: center; border-top: 1px dashed #e4e4e7; padding-top: 20px;">
          Questo è un invio automatico del sistema Poligest.<br/>
          <strong>Buon lavoro!</strong>
        </p>
      </div>
    </div>
  `;

  return { text, html };
}
