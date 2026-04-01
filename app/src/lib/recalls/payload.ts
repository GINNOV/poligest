import { NotificationChannel } from "@prisma/client";

export type AppointmentReminderTimingType = "DAYS_BEFORE" | "SAME_DAY_TIME";
export type ManualNotificationType = "appointment" | "event";

export type RecallRulePayload = {
  name: string;
  serviceType: string;
  intervalDays: number;
  templateName: string | null;
  message: string | null;
  emailSubject: string | null;
  channel: NotificationChannel;
};

export type AppointmentReminderRulePayload = {
  ruleId: string | null;
  daysBefore: number;
  timingType: AppointmentReminderTimingType;
  timeOfDayMinutes: number | null;
  templateName: string | null;
  emailSubject: string | null;
  message: string | null;
  enabled: boolean;
  channel: NotificationChannel;
};

export type ScheduledRecallPayload = {
  patientId: string;
  ruleId: string;
  dueAt: Date;
  notes: string | null;
};

export type RecurringMessagePayload = {
  kind: "HOLIDAY" | "CLOSURE" | "BIRTHDAY";
  subject: string;
  body: string;
  enabled: boolean;
  daysBefore: number | null;
};

export type ManualNotificationPayload = {
  notificationType: ManualNotificationType;
  channel: "EMAIL" | "SMS" | "BOTH";
  message: string;
  emailSubject: string;
  returnTo: string;
  appointmentId: string | null;
  patientId: string | null;
  eventTitle: string;
  eventAt: Date | null;
};

function parseTrimmedString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalTrimmedString(value: FormDataEntryValue | null): string | null {
  const trimmed = parseTrimmedString(value);
  return trimmed || null;
}

function parseNotificationChannel(value: string | null): NotificationChannel {
  const raw = value || NotificationChannel.EMAIL;
  return Object.values(NotificationChannel).includes(raw as NotificationChannel)
    ? (raw as NotificationChannel)
    : NotificationChannel.EMAIL;
}

function parseManualChannel(value: string | null): ManualNotificationPayload["channel"] {
  return value === "SMS" || value === "BOTH" ? value : "EMAIL";
}

export function parseCreateRecallRulePayload(formData: FormData): RecallRulePayload {
  const name = parseTrimmedString(formData.get("name"));
  const serviceType = parseTrimmedString(formData.get("serviceType"));
  const intervalDays = Number(formData.get("intervalDays"));
  const templateName = parseOptionalTrimmedString(formData.get("templateName"));
  const message = parseOptionalTrimmedString(formData.get("message"));
  const emailSubject = parseOptionalTrimmedString(formData.get("emailSubject"));
  const channel = parseNotificationChannel(parseOptionalTrimmedString(formData.get("channel")));

  if (!name || !serviceType || Number.isNaN(intervalDays) || intervalDays <= 0) {
    throw new Error("Dati regola non validi");
  }

  return { name, serviceType, intervalDays, templateName, message, emailSubject, channel };
}

export function parseUpdateRecallRulePayload(formData: FormData) {
  const ruleId = parseTrimmedString(formData.get("ruleId"));
  const payload = parseCreateRecallRulePayload(formData);
  if (!ruleId) {
    throw new Error("Dati regola non validi");
  }
  return { ruleId, ...payload };
}

export function parseAppointmentReminderRulePayload(formData: FormData): AppointmentReminderRulePayload {
  const ruleId = parseOptionalTrimmedString(formData.get("ruleId"));
  const daysBefore = Number(formData.get("daysBefore"));
  const timingTypeRaw = parseTrimmedString(formData.get("timingType")) || "SAME_DAY_TIME";
  const timingType: AppointmentReminderTimingType =
    timingTypeRaw === "DAYS_BEFORE" || timingTypeRaw === "SAME_DAY_TIME"
      ? timingTypeRaw
      : "SAME_DAY_TIME";
  const timeOfDayRaw = parseTrimmedString(formData.get("timeOfDay"));
  const timeMatch = timeOfDayRaw.match(/^(\d{1,2}):(\d{2})$/);
  const parsedMinutes = timeMatch
    ? Math.min(23, Math.max(0, Number(timeMatch[1]))) * 60 + Math.min(59, Math.max(0, Number(timeMatch[2])))
    : null;
  const timeOfDayMinutes = timingType === "SAME_DAY_TIME" ? parsedMinutes ?? 540 : null;
  const templateName = parseOptionalTrimmedString(formData.get("templateName"));
  const emailSubject = parseOptionalTrimmedString(formData.get("emailSubject"));
  const message = parseOptionalTrimmedString(formData.get("message"));
  const enabled = formData.get("enabled") === "on";
  const channel = parseNotificationChannel(parseOptionalTrimmedString(formData.get("channel")));

  if (timingType === "DAYS_BEFORE" && (Number.isNaN(daysBefore) || daysBefore <= 0)) {
    throw new Error("Intervallo non valido");
  }

  return {
    ruleId,
    daysBefore: Number.isNaN(daysBefore) || daysBefore <= 0 ? 1 : daysBefore,
    timingType,
    timeOfDayMinutes,
    templateName,
    emailSubject,
    message,
    enabled,
    channel,
  };
}

export function parseScheduledRecallPayload(formData: FormData): ScheduledRecallPayload {
  const patientId = parseTrimmedString(formData.get("patientId"));
  const ruleId = parseTrimmedString(formData.get("ruleId"));
  const dueAt = parseTrimmedString(formData.get("dueAt"));
  const notes = parseOptionalTrimmedString(formData.get("notes"));
  if (!patientId || !ruleId || !dueAt) throw new Error("Dati mancanti");
  return {
    patientId,
    ruleId,
    dueAt: new Date(dueAt),
    notes,
  };
}

export function parseRecurringMessagePayload(formData: FormData): RecurringMessagePayload {
  const kind = parseTrimmedString(formData.get("kind")) as RecurringMessagePayload["kind"];
  const subject = parseTrimmedString(formData.get("subject"));
  const body = parseTrimmedString(formData.get("body"));
  const enabled = formData.get("enabled") === "on";
  const daysBeforeRaw = formData.get("daysBefore");
  const daysBefore = daysBeforeRaw ? Number(daysBeforeRaw) : null;

  if (!kind || !subject || !body) {
    throw new Error("Configurazione non valida");
  }

  if (kind !== "HOLIDAY" && kind !== "CLOSURE" && kind !== "BIRTHDAY") {
    throw new Error("Configurazione non valida");
  }

  return { kind, subject, body, enabled, daysBefore };
}

export function parseManualNotificationPayload(formData: FormData): ManualNotificationPayload {
  const notificationType =
    parseTrimmedString(formData.get("notificationType")) === "event" ? "event" : "appointment";
  const channel = parseManualChannel(parseTrimmedString(formData.get("channel")));
  const message = parseTrimmedString(formData.get("message"));
  const emailSubject = parseTrimmedString(formData.get("emailSubject"));
  const returnTo = parseTrimmedString(formData.get("returnTo")) || "/richiami/manuale";
  const appointmentId = parseOptionalTrimmedString(formData.get("appointmentId"));
  const patientId = parseOptionalTrimmedString(formData.get("patientId"));
  const eventTitle = parseTrimmedString(formData.get("eventTitle"));
  const eventAtRaw = parseOptionalTrimmedString(formData.get("eventAt"));
  const eventAt = eventAtRaw ? new Date(eventAtRaw) : null;

  return {
    notificationType,
    channel,
    message,
    emailSubject,
    returnTo,
    appointmentId,
    patientId,
    eventTitle,
    eventAt: eventAt && !Number.isNaN(eventAt.getTime()) ? eventAt : null,
  };
}
