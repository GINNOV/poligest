import {
  AppointmentStatus,
  NotificationChannel,
  PracticeWeeklyReportStatus,
  RecallStatus,
  type Prisma,
  type Role,
} from "@prisma/client";
import { sendEmailWithHtml } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { autoCompletePastAppointments } from "@/lib/appointments/status-automation";

const REPORT_TIME_ZONE = "Europe/Rome";
const REPORT_CONFIG_ID = "default";

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "medium",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: REPORT_TIME_ZONE,
  weekday: "short",
});

const EURO_FORMATTER = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const PUBLIC_SITE_ORIGIN = "https://sorrisosplendente.com";

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) return "";
  if (/^https?:\/\//.test(rawOrigin)) return rawOrigin.replace(/\/$/, "");
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function isPublicSiteOrigin(origin: string) {
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    return !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveSiteOrigin() {
  const configuredOrigin = normalizeSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
  );

  if (isPublicSiteOrigin(configuredOrigin)) {
    return configuredOrigin;
  }

  return PUBLIC_SITE_ORIGIN;
}

type AuditActor = {
  id: string;
  role: Role;
};

type ChannelSummary = {
  records: number;
  emailTouches: number;
  smsTouches: number;
  bothChannelRecords: number;
};

type DoctorBreakdown = {
  doctorId: string;
  doctorName: string;
  appointmentsCompleted: number;
  uniquePatientsSeen: number;
};

type WeeklyReportMetrics = {
  completedAppointments: number;
  scheduledAppointments: number;
  uniquePatientsSeen: number;
  newPatients: number;
  confirmedAppointments: number;
  toConfirmAppointments: number;
  noShows: number;
  cancelledAppointments: number;
  upcomingAppointments: number;
  paymentsCollectedCount: number;
  paymentsCollectedTotal: number;
  quotesSigned: number;
  appointmentReminders: ChannelSummary;
  recallReminders: ChannelSummary;
  uniquePatientsReminded: number;
  perDoctor: DoctorBreakdown[];
};

export type WeeklyReportPeriod = {
  start: Date;
  endExclusive: Date;
  dedupeKey: string;
  label: string;
  startKey: string;
  endKey: string;
};

export type PracticeWeeklyReportResult =
  | {
      status: "sent";
      subject: string;
      recipientCount: number;
      dedupeKey: string;
      periodLabel: string;
    }
  | {
      status: "skipped";
      reason: string;
      dedupeKey?: string;
      periodLabel?: string;
    };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTimeZoneDateParts(date: Date) {
  const [year, month, day] = DATE_KEY_FORMATTER
    .format(date)
    .split("-")
    .map((value) => Number.parseInt(value, 10));

  const weekdayLabel = WEEKDAY_FORMATTER.format(date);
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year,
    month,
    day,
    weekday: weekdayMap[weekdayLabel] ?? 1,
  };
}

function getTimeZoneOffset(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcTimestamp = Date.UTC(
    Number.parseInt(values.year ?? "0", 10),
    Number.parseInt(values.month ?? "1", 10) - 1,
    Number.parseInt(values.day ?? "1", 10),
    Number.parseInt(values.hour ?? "0", 10),
    Number.parseInt(values.minute ?? "0", 10),
    Number.parseInt(values.second ?? "0", 10),
  );

  return utcTimestamp - date.getTime();
}

function toUtcForPracticeTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffset(guess);
  return new Date(guess.getTime() - offset);
}

function shiftCalendarDate(year: number, month: number, day: number, deltaDays: number) {
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function addPracticeDays(date: Date, days: number) {
  const parts = getTimeZoneDateParts(date);
  const shifted = shiftCalendarDate(parts.year, parts.month, parts.day, days);
  return toUtcForPracticeTime(shifted.year, shifted.month, shifted.day);
}

export function getCompletedPracticeWeekPeriod(now = new Date()): WeeklyReportPeriod {
  const today = getTimeZoneDateParts(now);
  const currentWeekStartDate = shiftCalendarDate(today.year, today.month, today.day, -(today.weekday - 1));
  const previousWeekStartDate = shiftCalendarDate(
    currentWeekStartDate.year,
    currentWeekStartDate.month,
    currentWeekStartDate.day,
    -7,
  );
  const previousWeekEndDate = shiftCalendarDate(
    currentWeekStartDate.year,
    currentWeekStartDate.month,
    currentWeekStartDate.day,
    -1,
  );
  const currentWeekStart = toUtcForPracticeTime(
    currentWeekStartDate.year,
    currentWeekStartDate.month,
    currentWeekStartDate.day,
  );
  const previousWeekStart = toUtcForPracticeTime(
    previousWeekStartDate.year,
    previousWeekStartDate.month,
    previousWeekStartDate.day,
  );
  const previousWeekEnd = toUtcForPracticeTime(
    previousWeekEndDate.year,
    previousWeekEndDate.month,
    previousWeekEndDate.day,
  );
  const startKey = DATE_KEY_FORMATTER.format(previousWeekStart);
  const endKey = DATE_KEY_FORMATTER.format(previousWeekEnd);

  return {
    start: previousWeekStart,
    endExclusive: currentWeekStart,
    dedupeKey: `practice-weekly-report:${startKey}`,
    label: `${DATE_LABEL_FORMATTER.format(previousWeekStart)} - ${DATE_LABEL_FORMATTER.format(previousWeekEnd)}`,
    startKey,
    endKey,
  };
}

export function parseRecipientEmails(raw: string) {
  const seen = new Set<string>();

  return raw
    .split(/[\n,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function createChannelSummary(): ChannelSummary {
  return {
    records: 0,
    emailTouches: 0,
    smsTouches: 0,
    bothChannelRecords: 0,
  };
}

export function summarizeChannels(channels: Array<NotificationChannel | null | undefined>) {
  const summary = createChannelSummary();

  for (const channel of channels) {
    summary.records += 1;
    if (channel === NotificationChannel.SMS) {
      summary.smsTouches += 1;
      continue;
    }
    if (channel === NotificationChannel.BOTH) {
      summary.emailTouches += 1;
      summary.smsTouches += 1;
      summary.bothChannelRecords += 1;
      continue;
    }

    summary.emailTouches += 1;
  }

  return summary;
}

function formatCurrency(value: number) {
  return EURO_FORMATTER.format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

async function collectWeeklyMetrics(period: WeeklyReportPeriod): Promise<WeeklyReportMetrics> {
  const [appointments, newPatients, paymentsAggregate, quotesSigned, appointmentReminders, recalls, upcomingAppointments] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          startsAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
        select: {
          status: true,
          patientId: true,
          doctorId: true,
          doctor: { select: { fullName: true } },
        },
      }),
      prisma.patient.count({
        where: {
          createdAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
      }),
      prisma.patientPayment.aggregate({
        where: {
          paidAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.quote.count({
        where: {
          signedAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
      }),
      prisma.appointmentReminder.findMany({
        where: {
          status: RecallStatus.CONTACTED,
          lastContactAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
        select: {
          patientId: true,
          rule: { select: { channel: true } },
        },
      }),
      prisma.recall.findMany({
        where: {
          status: RecallStatus.CONTACTED,
          lastContactAt: {
            gte: period.start,
            lt: period.endExclusive,
          },
        },
        select: {
          patientId: true,
          rule: { select: { channel: true } },
        },
      }),
      prisma.appointment.count({
        where: {
          startsAt: {
            gte: period.endExclusive,
            lt: addPracticeDays(period.endExclusive, 7),
          },
          status: {
            in: [
              AppointmentStatus.TO_CONFIRM,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_WAITING,
              AppointmentStatus.IN_PROGRESS,
            ],
          },
        },
      }),
    ]);

  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.COMPLETED,
  );
  const cancelledAppointments = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.CANCELLED,
  ).length;
  const confirmedAppointments = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.CONFIRMED,
  ).length;
  const toConfirmAppointments = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.TO_CONFIRM,
  ).length;
  const noShows = appointments.filter((appointment) => appointment.status === AppointmentStatus.NO_SHOW).length;
  const uniquePatientsSeen = new Set(completedAppointments.map((appointment) => appointment.patientId)).size;

  const doctorMap = new Map<
    string,
    {
      doctorName: string;
      appointmentsCompleted: number;
      patientIds: Set<string>;
    }
  >();

  for (const appointment of completedAppointments) {
    const doctorId = appointment.doctorId ?? "unassigned";
    const entry =
      doctorMap.get(doctorId) ??
      {
        doctorName: appointment.doctor?.fullName?.trim() || "Senza medico assegnato",
        appointmentsCompleted: 0,
        patientIds: new Set<string>(),
      };

    entry.appointmentsCompleted += 1;
    entry.patientIds.add(appointment.patientId);
    doctorMap.set(doctorId, entry);
  }

  const perDoctor: DoctorBreakdown[] = Array.from(doctorMap.entries())
    .map(([doctorId, entry]) => ({
      doctorId,
      doctorName: entry.doctorName,
      appointmentsCompleted: entry.appointmentsCompleted,
      uniquePatientsSeen: entry.patientIds.size,
    }))
    .sort((left, right) => {
      if (right.appointmentsCompleted !== left.appointmentsCompleted) {
        return right.appointmentsCompleted - left.appointmentsCompleted;
      }
      return left.doctorName.localeCompare(right.doctorName, "it", { sensitivity: "base" });
    });

  const appointmentReminderSummary = summarizeChannels(
    appointmentReminders.map((reminder) => reminder.rule.channel),
  );
  const recallReminderSummary = summarizeChannels(recalls.map((recall) => recall.rule.channel));
  const uniquePatientsReminded = new Set(
    [...appointmentReminders, ...recalls].map((reminder) => reminder.patientId),
  ).size;

  return {
    completedAppointments: completedAppointments.length,
    scheduledAppointments: appointments.length,
    uniquePatientsSeen,
    newPatients,
    confirmedAppointments,
    toConfirmAppointments,
    noShows,
    cancelledAppointments,
    upcomingAppointments,
    paymentsCollectedCount: paymentsAggregate._count._all,
    paymentsCollectedTotal: Number((paymentsAggregate._sum.amount as Prisma.Decimal | null)?.toString() ?? "0"),
    quotesSigned,
    appointmentReminders: appointmentReminderSummary,
    recallReminders: recallReminderSummary,
    uniquePatientsReminded,
    perDoctor,
  };
}

function buildSubject(period: WeeklyReportPeriod) {
  return `Report settimanale studio · ${period.label}`;
}

function buildTextBody(period: WeeklyReportPeriod, metrics: WeeklyReportMetrics) {
  const totalReminderTouches =
    metrics.appointmentReminders.emailTouches +
    metrics.appointmentReminders.smsTouches +
    metrics.recallReminders.emailTouches +
    metrics.recallReminders.smsTouches;
  const completionRate =
    metrics.scheduledAppointments > 0
      ? (metrics.completedAppointments / metrics.scheduledAppointments) * 100
      : 0;

  const doctorLines =
    metrics.perDoctor.length > 0
      ? metrics.perDoctor
          .map(
            (doctor) =>
              `- ${doctor.doctorName}: ${doctor.appointmentsCompleted} visite completate, ${doctor.uniquePatientsSeen} pazienti`,
          )
          .join("\n")
      : "- Nessuna visita completata";

  return [
    `Report settimanale ${period.label}`,
    "",
    `Visite completate: ${metrics.completedAppointments}`,
    `Pazienti visti: ${metrics.uniquePatientsSeen}`,
    `Nuovi pazienti: ${metrics.newPatients}`,
    `Tasso di completamento agenda: ${formatPercent(completionRate)}`,
    `Confermati rimasti: ${metrics.confirmedAppointments}`,
    `Da confermare rimasti: ${metrics.toConfirmAppointments}`,
    `No-show: ${metrics.noShows}`,
    `Annullamenti: ${metrics.cancelledAppointments}`,
    `Promemoria inviati (touch totali): ${totalReminderTouches}`,
    `Pazienti raggiunti da promemoria/richiami: ${metrics.uniquePatientsReminded}`,
    `Incassi registrati: ${formatCurrency(metrics.paymentsCollectedTotal)} su ${metrics.paymentsCollectedCount} pagamenti`,
    `Preventivi firmati: ${metrics.quotesSigned}`,
    `Appuntamenti già fissati per la prossima settimana: ${metrics.upcomingAppointments}`,
    "",
    "Visite per medico:",
    doctorLines,
  ].join("\n");
}

function buildKpiCard(label: string, value: string, detail: string) {
  return `
    <td style="padding:8px;vertical-align:top;">
      <div style="border:1px solid #e4e4e7;border-radius:16px;padding:16px;background:#fafafa;">
        <div style="font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">${escapeHtml(label)}</div>
        <div style="margin-top:10px;font-size:28px;line-height:32px;color:#18181b;font-weight:700;">${escapeHtml(value)}</div>
        <div style="margin-top:8px;font-size:13px;line-height:18px;color:#52525b;">${escapeHtml(detail)}</div>
      </div>
    </td>
  `;
}

function buildHtmlBody(period: WeeklyReportPeriod, metrics: WeeklyReportMetrics) {
  const siteOrigin = resolveSiteOrigin();
  const logoUrl = siteOrigin ? `${siteOrigin}/logo/studio_agovinoangrisano_logo.png` : "";
  const completionRate =
    metrics.scheduledAppointments > 0
      ? (metrics.completedAppointments / metrics.scheduledAppointments) * 100
      : 0;
  const totalReminderTouches =
    metrics.appointmentReminders.emailTouches +
    metrics.appointmentReminders.smsTouches +
    metrics.recallReminders.emailTouches +
    metrics.recallReminders.smsTouches;

  const doctorRows =
    metrics.perDoctor.length > 0
      ? metrics.perDoctor
          .map(
            (doctor) => `
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#18181b;font-weight:600;">${escapeHtml(doctor.doctorName)}</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#18181b;text-align:right;">${doctor.appointmentsCompleted}</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:14px;line-height:20px;color:#18181b;text-align:right;">${doctor.uniquePatientsSeen}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="3" style="padding:18px 14px;font-size:14px;line-height:20px;color:#71717a;text-align:center;">
              Nessuna visita completata nel periodo.
            </td>
          </tr>
        `;

  return `
    <div style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
      <div style="max-width:880px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden;">
        <div style="padding:28px 28px 20px;background:#ffffff;border-bottom:1px solid #e4e4e7;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    ${
                      logoUrl
                        ? `<td style="vertical-align:middle;padding-right:16px;">
                            <div style="height:56px;width:160px;border-radius:12px;background:#ffffff;padding:8px;box-sizing:border-box;">
                              <img src="${escapeHtml(logoUrl)}" alt="Logo Studio Agovino & Angrisano" width="144" height="40" style="display:block;height:40px;width:144px;object-fit:contain;" />
                            </div>
                          </td>`
                        : ""
                    }
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px;line-height:16px;color:#047857;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">Report settimanale</div>
                      <div style="margin-top:6px;font-size:30px;line-height:36px;color:#18181b;font-weight:700;">Studio Agovino &amp; Angrisano</div>
                      <div style="margin-top:6px;font-size:13px;line-height:18px;color:#71717a;">Periodo: ${escapeHtml(period.label)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:15px;line-height:22px;color:#52525b;">
            Una fotografia semplice dell'attività clinica, dei contatti automatici ai pazienti e dei risultati economici registrati in settimana.
          </p>
        </div>

        <div style="padding:20px 20px 6px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              ${buildKpiCard("Pazienti visti", String(metrics.uniquePatientsSeen), `${metrics.completedAppointments} visite completate`)}
              ${buildKpiCard("Nuovi pazienti", String(metrics.newPatients), "Nuove anagrafiche create nel periodo")}
              ${buildKpiCard("Incassi registrati", formatCurrency(metrics.paymentsCollectedTotal), `${metrics.paymentsCollectedCount} pagamenti registrati`)}
            </tr>
            <tr>
              ${buildKpiCard("Promemoria inviati", String(totalReminderTouches), `${metrics.uniquePatientsReminded} pazienti raggiunti`)}
              ${buildKpiCard("Tasso agenda completata", formatPercent(completionRate), `${metrics.cancelledAppointments} annullati · ${metrics.noShows} no-show`)}
              ${buildKpiCard("Agenda prossima settimana", String(metrics.upcomingAppointments), "Appuntamenti già fissati nei prossimi 7 giorni")}
            </tr>
          </table>
        </div>

        <div style="padding:0 28px 28px;">
          <div style="margin-top:18px;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
            <div style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e4e4e7;">
              <h2 style="margin:0;font-size:18px;line-height:24px;color:#18181b;">Visite completate per medico</h2>
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#ffffff;">
                  <th align="left" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Medico</th>
                  <th align="right" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Visite</th>
                  <th align="right" style="padding:12px 14px;border-bottom:1px solid #e4e4e7;font-size:12px;line-height:16px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">Pazienti</th>
                </tr>
              </thead>
              <tbody>${doctorRows}</tbody>
            </table>
          </div>

          <div style="margin-top:18px;border:1px solid #e4e4e7;border-radius:20px;padding:18px;">
            <h2 style="margin:0 0 14px;font-size:18px;line-height:24px;color:#18181b;">Valore generato dall'automazione</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#52525b;">Promemoria appuntamenti consegnati</td>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">
                  ${metrics.appointmentReminders.records} record · ${metrics.appointmentReminders.emailTouches} email · ${metrics.appointmentReminders.smsTouches} SMS
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#52525b;">Richiami automatici consegnati</td>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">
                  ${metrics.recallReminders.records} record · ${metrics.recallReminders.emailTouches} email · ${metrics.recallReminders.smsTouches} SMS
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#52525b;">Preventivi firmati</td>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">${metrics.quotesSigned}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top:18px;border:1px solid #e4e4e7;border-radius:20px;padding:18px;">
            <h2 style="margin:0 0 14px;font-size:18px;line-height:24px;color:#18181b;">FYI · Stato appuntamenti nel periodo</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#52525b;">Confermati</td>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">${metrics.confirmedAppointments}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#52525b;">Da confermare</td>
                <td style="padding:10px 0;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">${metrics.toConfirmAppointments}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#52525b;">Annullati</td>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">${metrics.cancelledAppointments}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#52525b;">No-show</td>
                <td style="padding:10px 0;border-top:1px solid #f4f4f5;font-size:14px;line-height:20px;color:#18181b;font-weight:600;text-align:right;">${metrics.noShows}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function sendPracticeWeeklyReport(params?: {
  now?: Date;
  force?: boolean;
  trigger?: "CRON" | "MANUAL" | "API";
  actor?: AuditActor | null;
}) {
  const now = params?.now ?? new Date();
  const force = params?.force ?? false;
  const trigger = params?.trigger ?? "CRON";
  const actor = params?.actor ?? null;
  const period = getCompletedPracticeWeekPeriod(now);

  const config = await prisma.practiceWeeklyReportConfig.findUnique({
    where: { id: REPORT_CONFIG_ID },
  });

  if (!config?.enabled) {
    return { status: "skipped", reason: "disabled", dedupeKey: period.dedupeKey, periodLabel: period.label } satisfies PracticeWeeklyReportResult;
  }

  const recipients = parseRecipientEmails(config.recipientEmails);
  if (recipients.length === 0) {
    return { status: "skipped", reason: "no_recipients", dedupeKey: period.dedupeKey, periodLabel: period.label } satisfies PracticeWeeklyReportResult;
  }

  if (!force) {
    const existingSent = await prisma.practiceWeeklyReportLog.findFirst({
      where: {
        dedupeKey: period.dedupeKey,
        status: PracticeWeeklyReportStatus.SENT,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingSent) {
      return { status: "skipped", reason: "already_sent", dedupeKey: period.dedupeKey, periodLabel: period.label } satisfies PracticeWeeklyReportResult;
    }
  }

  await autoCompletePastAppointments(now);
  const metrics = await collectWeeklyMetrics(period);
  const subject = buildSubject(period);
  const text = buildTextBody(period, metrics);
  const html = buildHtmlBody(period, metrics);

  try {
    for (const recipient of recipients) {
      await sendEmailWithHtml(recipient, subject, text, html);
    }

    await prisma.practiceWeeklyReportLog.create({
      data: {
        dedupeKey: period.dedupeKey,
        periodStart: period.start,
        periodEnd: period.endExclusive,
        recipientCount: recipients.length,
        subject,
        status: PracticeWeeklyReportStatus.SENT,
        trigger,
        sentAt: now,
      },
    });

    await logAudit(actor, {
      action: "practice.weekly_report_sent",
      entity: "System",
      entityId: period.dedupeKey,
      metadata: {
        trigger,
        recipientCount: recipients.length,
        periodStart: period.start.toISOString(),
        periodEndExclusive: period.endExclusive.toISOString(),
      },
    });

    return {
      status: "sent",
      subject,
      recipientCount: recipients.length,
      dedupeKey: period.dedupeKey,
      periodLabel: period.label,
    } satisfies PracticeWeeklyReportResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.practiceWeeklyReportLog.create({
      data: {
        dedupeKey: period.dedupeKey,
        periodStart: period.start,
        periodEnd: period.endExclusive,
        recipientCount: recipients.length,
        subject,
        status: PracticeWeeklyReportStatus.FAILED,
        trigger,
        error: message,
      },
    });

    throw error;
  }
}

export { REPORT_CONFIG_ID, REPORT_TIME_ZONE };
