import { AppointmentStatus, RecallStatus } from "@prisma/client";
import { replacePlaceholders } from "@/lib/email-template-utils";
import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import { addDaysInTimeZone, formatDateInTimeZone, setTimeOfDayInTimeZone } from "@/lib/time-zone";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type PatientMaxDateEntry = {
  patientId: string;
  _max?: { startsAt?: Date | null; dueAt?: Date | null } | null;
};

export function computeRecurringRecallCreates(params: {
  now: Date;
  horizon: Date;
  rule: { id: string; intervalDays: number };
  lastAppointments: PatientMaxDateEntry[];
  lastRecalls: PatientMaxDateEntry[];
  pendingRecalls: PatientMaxDateEntry[];
}) {
  const lastRecallByPatient = new Map(
    params.lastRecalls
      .map((entry) => [entry.patientId, entry._max?.dueAt ?? null] as const)
      .filter((entry): entry is [string, Date] => Boolean(entry[1])),
  );
  const pendingRecallByPatient = new Map(
    params.pendingRecalls
      .map((entry) => [entry.patientId, entry._max?.dueAt ?? null] as const)
      .filter((entry): entry is [string, Date] => Boolean(entry[1])),
  );

  return params.lastAppointments
    .map((entry) => {
      const lastVisit = entry._max?.startsAt ?? null;
      if (!lastVisit || pendingRecallByPatient.has(entry.patientId)) return null;

      const lastRecallDueAt = lastRecallByPatient.get(entry.patientId);
      let nextDueAt = addDays(lastVisit, params.rule.intervalDays);

      if (lastRecallDueAt && lastRecallDueAt >= lastVisit) {
        nextDueAt = addDays(lastRecallDueAt, params.rule.intervalDays);
      }

      if (nextDueAt < params.now) nextDueAt = params.now;
      if (nextDueAt > params.horizon) return null;

      return {
        patientId: entry.patientId,
        ruleId: params.rule.id,
        dueAt: nextDueAt,
        status: RecallStatus.PENDING,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
}

export function computeAppointmentReminderCreates(params: {
  now: Date;
  horizon: Date;
  timeZone?: string;
  rule: {
    id: string;
    daysBefore: number;
    timingType: "DAYS_BEFORE" | "SAME_DAY_TIME";
    timeOfDayMinutes: number | null;
  };
  appointments: Array<{
    id: string;
    patientId: string;
    startsAt: Date;
    status?: AppointmentStatus;
  }>;
}) {
  const timeOfDayMinutes =
    typeof params.rule.timeOfDayMinutes === "number" ? params.rule.timeOfDayMinutes : 540;
  const timeZone = params.timeZone ?? DEFAULT_PRACTICE_TIME_ZONE;

  return params.appointments
    .map((appointment) => {
      const baseDate =
        params.rule.timingType === "SAME_DAY_TIME"
          ? appointment.startsAt
          : addDaysInTimeZone(appointment.startsAt, -params.rule.daysBefore, timeZone);
      let dueAt = setTimeOfDayInTimeZone(baseDate, timeOfDayMinutes, timeZone);

      if (dueAt < params.now) dueAt = params.now;
      if (dueAt > params.horizon) return null;

      return {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        ruleId: params.rule.id,
        dueAt,
        status: RecallStatus.PENDING,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
}

export function shouldSkipAppointmentReminder(
  now: Date,
  appointment: { startsAt: Date; status: AppointmentStatus },
) {
  return (
    appointment.startsAt <= now ||
    appointment.status === AppointmentStatus.CANCELLED ||
    appointment.status === AppointmentStatus.NO_SHOW ||
    appointment.status === AppointmentStatus.COMPLETED
  );
}

function buildChannelPlan(channel: "EMAIL" | "SMS" | "BOTH" | null | undefined) {
  const normalized = channel ?? "EMAIL";
  return {
    wantsEmail: normalized === "EMAIL" || normalized === "BOTH",
    wantsSms: normalized === "SMS" || normalized === "BOTH",
  };
}

export function buildRecallDeliveryPlan(params: {
  patient: { firstName: string | null; lastName: string | null };
  rule: {
    serviceType?: string | null;
    emailSubject?: string | null;
    message?: string | null;
    channel?: "EMAIL" | "SMS" | "BOTH" | null;
  };
  template?: { subject: string | null; body: string | null } | null;
}) {
  const patientName =
    `${params.patient.lastName ?? ""} ${params.patient.firstName ?? ""}`.trim() || "paziente";
  const serviceLabel =
    params.rule.serviceType === "ANY" ? "il prossimo controllo" : params.rule.serviceType ?? "";
  const placeholderData = {
    patientName,
    patientFirstName: params.patient.firstName ?? "",
    patientLastName: params.patient.lastName ?? "",
    serviceType: serviceLabel,
    button: "",
  };

  return {
    ...buildChannelPlan(params.rule.channel),
    subject: replacePlaceholders(
      params.template?.subject ?? params.rule.emailSubject ?? `Promemoria ${serviceLabel}`,
      placeholderData,
    ),
    body: replacePlaceholders(
      params.template?.body ??
        params.rule.message ??
        `Gentile {{patientName}}, promemoria per ${serviceLabel}.`,
      placeholderData,
    ),
  };
}

export function buildAppointmentReminderDeliveryPlan(params: {
  patient: { firstName: string | null; lastName: string | null };
  appointment: { startsAt: Date; doctor: { fullName: string | null } | null };
  timeZone?: string;
  rule: {
    emailSubject?: string | null;
    message?: string | null;
    channel?: "EMAIL" | "SMS" | "BOTH" | null;
  };
  template?: { subject: string | null; body: string | null } | null;
}) {
  const timeZone = params.timeZone ?? DEFAULT_PRACTICE_TIME_ZONE;
  const patientName =
    `${params.patient.lastName ?? ""} ${params.patient.firstName ?? ""}`.trim() || "paziente";
  const placeholderData = {
    patientName,
    appointmentDate: formatDateInTimeZone(
      params.appointment.startsAt,
      { dateStyle: "medium" },
      timeZone,
    ),
    appointmentTime: formatDateInTimeZone(
      params.appointment.startsAt,
      { timeStyle: "short" },
      timeZone,
    ),
    doctorName: params.appointment.doctor?.fullName ?? "lo staff",
    button: "",
  };

  return {
    ...buildChannelPlan(params.rule.channel),
    subject: replacePlaceholders(
      params.template?.subject ?? params.rule.emailSubject ?? "Promemoria appuntamento",
      placeholderData,
    ),
    body: replacePlaceholders(
      params.template?.body ??
        params.rule.message ??
        "Gentile {{patientName}}, promemoria per l'appuntamento del {{appointmentDate}} alle {{appointmentTime}} con {{doctorName}}.",
      placeholderData,
    ),
  };
}
