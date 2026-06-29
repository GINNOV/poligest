import { AppointmentStatus, RecurringMessageStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailWithHtml } from "@/lib/email";
import { logAudit, resolveAppointmentSchedulers } from "@/lib/audit";
import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import {
  buildReportEmailHeader,
  buildReportKpiCard,
  escapeReportHtml,
  resolveReportSiteOrigin,
  wrapReportEmailBody,
} from "@/lib/report-email-layout";
import {
  formatDateInDisplayTimeZone,
  formatDateInputValueInTimeZone,
  formatTimeInputValueInTimeZone,
  parseDateAtMidnightInTimeZone,
} from "@/lib/user-display-time-zone";

export const DAILY_REMINDER_CONFIG_ID = "default";
export const DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES = 20 * 60; // 20:00 Italy time
export const DEFAULT_DAILY_REMINDER_TARGET_ROLES: Role[] = [Role.MANAGER, Role.ADMIN];
export const DEFAULT_DAILY_REMINDER_BCC_EMAIL = "studio.agovino.angrisano@gmail.com";
export const DAILY_REMINDER_SEND_WINDOW_MINUTES = 120;

export function normalizeDailyReminderBccEmail(raw: string | null | undefined) {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function resolveDailyReminderBccEmail(
  configuredBccEmail: string | null | undefined,
  recipientEmail?: string | null,
) {
  if (configuredBccEmail === null) {
    return undefined;
  }

  const bccEmail = normalizeDailyReminderBccEmail(
    configuredBccEmail ?? DEFAULT_DAILY_REMINDER_BCC_EMAIL,
  );
  if (!bccEmail) return undefined;

  const normalizedRecipient = recipientEmail?.trim().toLowerCase();
  if (normalizedRecipient && normalizedRecipient === bccEmail) {
    return undefined;
  }

  return bccEmail;
}

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.TO_CONFIRM]: "Da confermare",
  [AppointmentStatus.CONFIRMED]: "Confermato",
  [AppointmentStatus.IN_WAITING]: "In attesa",
  [AppointmentStatus.IN_PROGRESS]: "In corso",
  [AppointmentStatus.COMPLETED]: "Completato",
  [AppointmentStatus.CANCELLED]: "Annullato",
  [AppointmentStatus.NO_SHOW]: "No-show",
};

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

export function getMinutesOfDayInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

export function shouldSendDailyReminderNow(params: {
  now: Date;
  timeZone: string;
  sendTimeMinutes: number;
  force?: boolean;
}) {
  if (params.force) return true;

  const currentMinutes = getMinutesOfDayInTimeZone(params.now, params.timeZone);
  if (currentMinutes < params.sendTimeMinutes) {
    return false;
  }

  return currentMinutes < params.sendTimeMinutes + DAILY_REMINDER_SEND_WINDOW_MINUTES;
}

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
  const sendTimeMinutes = config?.sendTimeMinutes ?? DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES;
  const targetRoles = config?.targetRoles ?? DEFAULT_DAILY_REMINDER_TARGET_ROLES;

  if (!isEnabled && !force) {
    return { status: "skipped", reason: "disabled" } satisfies DailyReminderResult;
  }

  if (!shouldSendDailyReminderNow({ now, timeZone, sendTimeMinutes, force })) {
    const currentMinutes = getMinutesOfDayInTimeZone(now, timeZone);
    const reason =
      currentMinutes < sendTimeMinutes ? "before_send_time" : "after_send_window";
    return { status: "skipped", reason } satisfies DailyReminderResult;
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const targetDateStr = formatDateInputValueInTimeZone(tomorrow, timeZone);
  const targetDateMidnight = parseDateAtMidnightInTimeZone(targetDateStr, timeZone);
  const targetDateEnd = new Date(targetDateMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);

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

    const schedulerByAppointmentId = await resolveAppointmentSchedulers(
      appointments.map((appointment) => appointment.id),
    );
    const subject = buildDailyReminderSubject(targetDateMidnight, timeZone);
    const { text, html } = generateDailyReminderContent(
      user,
      appointments,
      targetDateMidnight,
      timeZone,
      schedulerByAppointmentId,
    );

    try {
      const bcc = resolveDailyReminderBccEmail(config?.bccEmail, user.email);
      await sendEmailWithHtml(user.email, subject, text, html, bcc ? { bcc } : undefined);
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
        recipientCount: results.filter((result) => result.status === "sent").length,
        targetDate: targetDateStr,
      },
    });
  }

  return { status: "completed", results } satisfies DailyReminderResult;
}

export type DailyReminderPreviewResult =
  | { status: "success"; subject: string; text: string; html: string; count: number }
  | { status: "no_doctor"; message: string };

export async function generateDailyReminderPreview(
  userId: string,
  targetDate: Date,
  timeZone: string,
): Promise<DailyReminderPreviewResult> {
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

  const schedulerByAppointmentId = await resolveAppointmentSchedulers(
    appointments.map((appointment) => appointment.id),
  );
  const subject = buildDailyReminderSubject(targetDateMidnight, timeZone);
  const { text, html } = generateDailyReminderContent(
    user,
    appointments,
    targetDateMidnight,
    timeZone,
    schedulerByAppointmentId,
  );

  return { status: "success", subject, text, html, count: appointments.length };
}

type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;
type AppointmentWithPatient = Prisma.AppointmentGetPayload<{ include: { patient: true } }>;

export function buildDailyReminderSubject(date: Date, timeZone: string) {
  const dateLabel = formatDateInDisplayTimeZone(date, { dateStyle: "medium" }, timeZone);
  return `Agenda di domani · ${dateLabel}`;
}

export function generateDailyReminderContent(
  user: UserWithDoctor,
  appointments: AppointmentWithPatient[],
  date: Date,
  timeZone: string,
  schedulerByAppointmentId: Map<string, string> = new Map(),
) {
  const dateLabel = formatDateInDisplayTimeZone(date, { dateStyle: "full" }, timeZone);
  const doctorName = user.doctor?.fullName ?? user.name ?? user.email;
  const siteOrigin = resolveReportSiteOrigin();
  const agendaUrl = `${siteOrigin}/agenda`;

  const rows = appointments.map((appt) => {
    const time = formatTimeInputValueInTimeZone(appt.startsAt, timeZone);
    const endTime = formatTimeInputValueInTimeZone(appt.endsAt, timeZone);
    const patientName = `${appt.patient.lastName} ${appt.patient.firstName}`;
    const notes = appt.notes?.trim() || "—";
    const statusLabel = APPOINTMENT_STATUS_LABELS[appt.status];
    const scheduledBy = schedulerByAppointmentId.get(appt.id) ?? "Non tracciato";
    return { time, endTime, patientName, notes, statusLabel, scheduledBy };
  });

  const confirmedCount = appointments.filter((appt) => appt.status === AppointmentStatus.CONFIRMED).length;
  const toConfirmCount = appointments.filter((appt) => appt.status === AppointmentStatus.TO_CONFIRM).length;

  const text = [
    `Agenda di domani · ${dateLabel}`,
    "",
    `Ciao ${doctorName},`,
    `Ecco il riepilogo dei tuoi appuntamenti per ${dateLabel}:`,
    "",
    ...rows.map(
      (row) =>
        `${row.time} - ${row.endTime} · ${row.patientName} (${row.statusLabel})\nPrenotato da: ${row.scheduledBy}\nNote: ${row.notes}`,
    ),
    "",
    `Totale appuntamenti: ${appointments.length}`,
    `Confermati: ${confirmedCount}`,
    `Da confermare: ${toConfirmCount}`,
    "",
    "Buon lavoro!",
  ].join("\n");

  const appointmentRows =
    rows.length > 0
      ? rows
          .map(
            (row, index) => `
              <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fafafa"};">
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#047857;font-weight:700;white-space:nowrap;">
                  ${escapeReportHtml(row.time)} - ${escapeReportHtml(row.endTime)}
                </td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;font-weight:600;">
                  ${escapeReportHtml(row.patientName)}
                </td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#18181b;">
                  ${escapeReportHtml(row.statusLabel)}
                </td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#18181b;">
                  ${escapeReportHtml(row.scheduledBy)}
                </td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:13px;line-height:18px;color:#52525b;">
                  ${escapeReportHtml(row.notes)}
                </td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5" style="padding:18px 14px;font-size:14px;line-height:20px;color:#71717a;text-align:center;">
              Nessun appuntamento programmato.
            </td>
          </tr>
        `;

  const html = wrapReportEmailBody(`
    ${buildReportEmailHeader({
      badge: "Agenda di domani",
      title: doctorName,
      subtitle: `Data: ${dateLabel}`,
      intro: `Ciao ${doctorName}, ecco il riepilogo dei tuoi appuntamenti per domani.`,
    })}

    <div style="padding:20px 20px 6px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          ${buildReportKpiCard("Appuntamenti", String(appointments.length), "Visite programmate per domani")}
          ${buildReportKpiCard(
            "Confermati",
            String(confirmedCount),
            "Appuntamenti già confermati",
            {
              background: "#dcfce7",
              borderColor: "#86efac",
              labelColor: "#166534",
              valueColor: "#14532d",
              detailColor: "#166534",
            },
          )}
          ${buildReportKpiCard("Da confermare", String(toConfirmCount), "Richiedono conferma")}
        </tr>
      </table>
    </div>

    <div style="padding:0 28px 28px;">
      <div style="margin-top:18px;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
        <div style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e4e4e7;">
          <h2 style="margin:0;font-size:18px;line-height:24px;color:#18181b;">Dettaglio appuntamenti</h2>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#ffffff;">
              <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Orario</th>
              <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Paziente</th>
              <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Stato</th>
              <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Prenotato da</th>
              <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Note</th>
            </tr>
          </thead>
          <tbody>${appointmentRows}</tbody>
        </table>
      </div>

      <div style="margin-top:18px;border:1px solid #e4e4e7;border-radius:20px;padding:18px;text-align:center;">
        <a href="${escapeReportHtml(agendaUrl)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">
          Apri agenda
        </a>
        <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#71717a;">
          Invio automatico del sistema Poligest · Buon lavoro!
        </p>
      </div>
    </div>
  `);

  return { text, html };
}