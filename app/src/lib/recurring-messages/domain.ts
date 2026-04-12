import { RecurringMessageKind, RecurringMessageStatus } from "@prisma/client";
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
};

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

export function buildAdminBackupReminderBody(params: {
  adminName: string | null;
  adminResetUrl: string;
  monthLabel: string;
}) {
  const greeting = params.adminName?.trim() ? `Ciao ${params.adminName.trim()},` : "Ciao,";
  return [
    `${greeting}`,
    "",
    `ti ricordiamo di eseguire il backup mensile di PoliGest per ${params.monthLabel}.`,
    "",
    "Passaggi consigliati:",
    "1. Accedi alla dashboard amministrativa di PoliGest.",
    "2. Apri la sezione Admin > Sistema: Database.",
    "3. Nella scheda \"Esporta dati\" lascia selezionate le tabelle necessarie.",
    "4. Premi \"Esporta selezione\" e salva il file JSON in una cartella sicura.",
    "5. Dalla stessa pagina esporta anche il CSV del magazzino, se ti serve una copia operativa.",
    "6. Verifica che i file si aprano correttamente e annota la data del backup.",
    "",
    `Link diretto: ${params.adminResetUrl}`,
    "",
    "Suggerimento: conserva almeno una copia locale e una copia in uno spazio cloud protetto.",
  ].join("\n");
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

      return {
        userId: admin.id,
        email: admin.email,
        name: admin.name,
        monthKey,
        auditEntityId,
        subject: `Promemoria backup mensile PoliGest - ${monthLabel}`,
        body: buildAdminBackupReminderBody({
          adminName: admin.name,
          adminResetUrl: params.adminResetUrl,
          monthLabel,
        }),
      };
    })
    .filter((candidate): candidate is AdminBackupReminderCandidate => candidate !== null);
}
