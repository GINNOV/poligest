import { RecurringMessageKind, RecurringMessageStatus } from "@prisma/client";
import { APP_BRAND_NAME } from "@/lib/brand";
import {
  RECURRING_MESSAGE_DEFAULTS,
  applyTemplate,
  getItalianHolidays,
  type HolidayDefinition,
} from "@/lib/recurring-messages";
import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import { formatDateInTimeZone, isSameTimeZoneDate, toUtcForTimeZone } from "@/lib/time-zone";

export type RecurringMessageConfigRecord = {
  kind: RecurringMessageKind;
  enabled: boolean;
  subject: string;
  body: string;
  daysBefore: number | null;
};

export type RecurringMessagePatientRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
};

export type PracticeClosureRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
};

export type RecurringCandidate = {
  kind: RecurringMessageKind;
  patientId: string;
  email: string;
  scheduledFor: Date;
  eventDate?: Date;
  dedupeKey: string;
  templateVars: Record<string, string>;
  subject: string;
  body: string;
};

export type AdminBackupReminderCandidate = {
  userId: string;
  email: string;
  name: string | null;
  monthKey: string;
  auditEntityId: string;
  subject: string;
  body: string;
  html: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function setLocalHour(date: Date, hour: number, timeZone: string) {
  return toUtcForTimeZone(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

function formatDate(date: Date, timeZone: string) {
  return formatDateInTimeZone(date, { dateStyle: "long" }, timeZone);
}

function formatMonthLabel(date: Date, timeZone: string) {
  return formatDateInTimeZone(
    date,
    {
      month: "long",
      year: "numeric",
    },
    timeZone,
  );
}

function normalizeBirthday(base: Date, year: number) {
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  if (month === 1 && day === 29) {
    return new Date(Date.UTC(year, 1, 28));
  }
  return new Date(Date.UTC(year, month, day));
}

export function mergeRecurringConfigs(
  stored: Array<Partial<RecurringMessageConfigRecord> & { kind: RecurringMessageKind }>,
): RecurringMessageConfigRecord[] {
  return RECURRING_MESSAGE_DEFAULTS.map((defaults) => {
    const match = stored.find((entry) => entry.kind === defaults.kind);
    return {
      kind: defaults.kind as RecurringMessageKind,
      enabled: match?.enabled ?? true,
      subject: match?.subject ?? defaults.subject,
      body: match?.body ?? defaults.body,
      daysBefore: match?.daysBefore ?? defaults.daysBefore ?? null,
    };
  });
}

export function buildRecurringCandidates(params: {
  now: Date;
  configs: RecurringMessageConfigRecord[];
  patients: RecurringMessagePatientRecord[];
  closures: PracticeClosureRecord[];
  holidays?: HolidayDefinition[];
  timeZone?: string;
}) {
  const timeZone = params.timeZone ?? DEFAULT_PRACTICE_TIME_ZONE;
  const { now, configs, patients, closures, holidays = getItalianHolidays(now.getFullYear()) } = params;
  const candidates: RecurringCandidate[] = [];

  const holidayConfig = configs.find((config) => config.kind === RecurringMessageKind.HOLIDAY && config.enabled);
  if (holidayConfig) {
    for (const holiday of holidays) {
      const scheduledFor = setLocalHour(holiday.date, 9, timeZone);
      if (!(now >= scheduledFor && isSameTimeZoneDate(now, scheduledFor, timeZone))) continue;

      for (const patient of patients) {
        candidates.push({
          kind: RecurringMessageKind.HOLIDAY,
          patientId: patient.id,
          email: patient.email,
          scheduledFor,
          eventDate: holiday.date,
          dedupeKey: `holiday:${holiday.key}:${holiday.date.getUTCFullYear()}:${patient.id}`,
          templateVars: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            holidayName: holiday.name,
            holidayDate: formatDate(holiday.date, timeZone),
          },
          subject: holidayConfig.subject,
          body: holidayConfig.body,
        });
      }
    }
  }

  const closureConfig = configs.find((config) => config.kind === RecurringMessageKind.CLOSURE && config.enabled);
  if (closureConfig) {
    const daysBefore = closureConfig.daysBefore ?? 7;
    for (const closure of closures) {
      const scheduledFor = setLocalHour(addDays(closure.startsAt, -daysBefore), 9, timeZone);
      if (!(now >= scheduledFor && now < closure.startsAt && isSameTimeZoneDate(now, scheduledFor, timeZone))) continue;

      const closureTitle = closure.title ?? "chiusura programmata";
      for (const patient of patients) {
        candidates.push({
          kind: RecurringMessageKind.CLOSURE,
          patientId: patient.id,
          email: patient.email,
          scheduledFor,
          eventDate: closure.startsAt,
          dedupeKey: `closure:${closure.id}:${patient.id}`,
          templateVars: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            closureTitle,
            closureStart: formatDate(closure.startsAt, timeZone),
            closureEnd: formatDate(closure.endsAt, timeZone),
          },
          subject: closureConfig.subject,
          body: closureConfig.body,
        });
      }
    }
  }

  const birthdayConfig = configs.find((config) => config.kind === RecurringMessageKind.BIRTHDAY && config.enabled);
  if (birthdayConfig) {
    for (const patient of patients) {
      if (!patient.birthDate) continue;
      const birthdayThisYear = normalizeBirthday(patient.birthDate, now.getFullYear());
      const scheduledFor = setLocalHour(birthdayThisYear, 9, timeZone);
      if (!(now >= scheduledFor && isSameTimeZoneDate(now, scheduledFor, timeZone))) continue;

      candidates.push({
        kind: RecurringMessageKind.BIRTHDAY,
        patientId: patient.id,
        email: patient.email,
        scheduledFor,
        eventDate: birthdayThisYear,
        dedupeKey: `birthday:${birthdayThisYear.getFullYear()}:${patient.id}`,
        templateVars: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthdayDate: formatDate(birthdayThisYear, timeZone),
        },
        subject: birthdayConfig.subject,
        body: birthdayConfig.body,
      });
    }
  }

  return candidates;
}

export function filterRecurringCandidates(params: {
  candidates: RecurringCandidate[];
  existingStatuses: Map<string, RecurringMessageStatus>;
  maxSend: number;
}) {
  const selected: RecurringCandidate[] = [];

  for (const candidate of params.candidates) {
    if (selected.length >= params.maxSend) break;

    const existingStatus = params.existingStatuses.get(candidate.dedupeKey);
    if (
      existingStatus === RecurringMessageStatus.SENT ||
      existingStatus === RecurringMessageStatus.SKIPPED
    ) {
      continue;
    }

    selected.push(candidate);
  }

  return selected;
}

export function materializeRecurringDelivery(candidate: RecurringCandidate) {
  return {
    subject: applyTemplate(candidate.subject, candidate.templateVars),
    body: applyTemplate(candidate.body, candidate.templateVars),
  };
}

export function getAdminBackupReminderMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const ADMIN_BACKUP_REMINDER_STEPS = [
  `Accedi alla dashboard amministrativa di ${APP_BRAND_NAME}.`,
  "Apri la sezione Admin > Sistema: Database.",
  'Nella cartella Esportazione, seleziona "Tutto il database".',
  'Clicca "Genera il backup" e conserva il file su una chiavetta per usi futuri.',
  "Dalla stessa pagina esporta anche il CSV del magazzino, se ti serve una copia operativa.",
  "Verifica che i file si aprano correttamente e annota la data del backup.",
] as const;

export function buildAdminBackupReminderBody(params: {
  adminName: string | null;
  adminResetUrl: string;
  monthLabel: string;
}) {
  const greeting = params.adminName?.trim() ? `Ciao ${params.adminName.trim()},` : "Ciao,";
  return [
    `${greeting}`,
    "",
    `ti ricordiamo di eseguire il backup mensile di ${APP_BRAND_NAME} per ${params.monthLabel}.`,
    "",
    "Passaggi consigliati:",
    ...ADMIN_BACKUP_REMINDER_STEPS.map((step, index) => `${index + 1}. ${step}`),
    "",
    `Link diretto: ${params.adminResetUrl}`,
    "",
    "Suggerimento: conserva almeno una copia locale e una copia in uno spazio cloud protetto.",
  ].join("\n");
}

export function buildAdminBackupReminderHtml(params: {
  adminName: string | null;
  adminResetUrl: string;
  monthLabel: string;
}) {
  const greetingName = params.adminName?.trim() ? escapeHtml(params.adminName.trim()) : null;
  const greeting = greetingName ? `Ciao <strong>${greetingName}</strong>,` : "Ciao,";
  const monthLabel = escapeHtml(params.monthLabel);
  const adminResetUrl = escapeHtml(params.adminResetUrl);
  const steps = ADMIN_BACKUP_REMINDER_STEPS.map(
    (step) => `<li style="margin-bottom:10px;">${escapeHtml(step)}</li>`,
  ).join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#18181b;line-height:1.5;">
      <div style="background-color:#047857;padding:24px;text-align:center;border-radius:16px 16px 0 0;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#d1fae5;">
          Manutenzione sistema
        </p>
        <h1 style="margin:8px 0 0;font-size:24px;color:#ffffff;">Backup mensile ${APP_BRAND_NAME}</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#d1fae5;">${monthLabel}</p>
      </div>
      <div style="padding:24px;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 16px 16px;background:#ffffff;">
        <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">${greeting}</p>
        <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;">
          ti ricordiamo di eseguire il backup mensile di ${APP_BRAND_NAME} per <strong>${monthLabel}</strong>.
        </p>

        <div style="margin:0 0 24px;padding:18px;border:1px solid #e4e4e7;border-radius:12px;background:#fafafa;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#18181b;">Passaggi consigliati</p>
          <ol style="margin:0;padding-left:20px;font-size:14px;color:#52525b;">${steps}</ol>
        </div>

        <div style="text-align:center;margin:0 0 24px;">
          <a href="${adminResetUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#047857;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            Apri Admin &gt; Sistema: Database
          </a>
        </div>

        <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-align:center;">
          Link diretto:
          <a href="${adminResetUrl}" style="color:#047857;text-decoration:none;">${adminResetUrl}</a>
        </p>

        <p style="margin:24px 0 0;padding-top:20px;border-top:1px dashed #e4e4e7;font-size:13px;color:#71717a;text-align:center;">
          <strong>Suggerimento:</strong> conserva almeno una copia locale e una copia in uno spazio cloud protetto.
        </p>
      </div>
    </div>
  `;
}

export function buildAdminBackupReminderCandidates(params: {
  now: Date;
  admins: Array<{ id: string; email: string; name: string | null }>;
  existingAuditEntityIds: Set<string>;
  adminResetUrl: string;
  timeZone?: string;
}) {
  const monthKey = getAdminBackupReminderMonthKey(params.now);
  const monthLabel = formatMonthLabel(params.now, params.timeZone ?? DEFAULT_PRACTICE_TIME_ZONE);

  return params.admins
    .map((admin): AdminBackupReminderCandidate | null => {
      const auditEntityId = `${admin.id}:${monthKey}`;
      if (params.existingAuditEntityIds.has(auditEntityId)) {
        return null;
      }

      const reminderParams = {
        adminName: admin.name,
        adminResetUrl: params.adminResetUrl,
        monthLabel,
      };

      return {
        userId: admin.id,
        email: admin.email,
        name: admin.name,
        monthKey,
        auditEntityId,
        subject: `Promemoria backup mensile ${APP_BRAND_NAME} - ${monthLabel}`,
        body: buildAdminBackupReminderBody(reminderParams),
        html: buildAdminBackupReminderHtml(reminderParams),
      };
    })
    .filter((candidate): candidate is AdminBackupReminderCandidate => candidate !== null);
}
