import { Prisma, RecallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AppointmentReminderRulePayload,
  ManualNotificationPayload,
  RecurringMessagePayload,
  RecallRulePayload,
  ScheduledRecallPayload,
} from "@/lib/recalls/payload";

function isPrismaUnknownArgumentError(err: unknown, argumentName: string) {
  return err instanceof Error && err.message.includes(`Unknown argument \`${argumentName}\``);
}

export async function createRecallRuleRecord(payload: RecallRulePayload) {
  const data: Partial<Prisma.RecallRuleCreateInput> = {
    name: payload.name,
    serviceType: payload.serviceType,
    intervalDays: payload.intervalDays,
    templateName: payload.templateName,
    message: payload.message,
    emailSubject: payload.emailSubject,
    channel: payload.channel,
  };

  try {
    await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
  } catch (err: unknown) {
    if (isPrismaUnknownArgumentError(err, "emailSubject")) delete data.emailSubject;
    if (isPrismaUnknownArgumentError(err, "templateName")) delete data.templateName;
    if (isPrismaUnknownArgumentError(err, "channel")) delete data.channel;
    await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
  }
}

export async function updateRecallRuleRecord(payload: RecallRulePayload & { ruleId: string }) {
  await prisma.recallRule.update({
    where: { id: payload.ruleId },
    data: {
      name: payload.name,
      serviceType: payload.serviceType,
      intervalDays: payload.intervalDays,
      templateName: payload.templateName,
      message: payload.message,
      emailSubject: payload.emailSubject,
      channel: payload.channel,
    },
  });
}

export async function upsertAppointmentReminderRuleRecord(payload: AppointmentReminderRulePayload) {
  const data: Partial<
    Prisma.AppointmentReminderRuleCreateInput & Prisma.AppointmentReminderRuleUpdateInput
  > = {
    daysBefore: payload.daysBefore,
    channel: payload.channel,
    emailSubject: payload.emailSubject,
    message: payload.message,
    enabled: payload.enabled,
    templateName: payload.templateName,
    timingType: payload.timingType,
    timeOfDayMinutes: payload.timeOfDayMinutes,
  };

  try {
    if (payload.ruleId) {
      await prisma.appointmentReminderRule.update({
        where: { id: payload.ruleId },
        data: data as Prisma.AppointmentReminderRuleUpdateInput,
      });
      return;
    }

    const existing = await prisma.appointmentReminderRule.findFirst();
    if (existing) {
      await prisma.appointmentReminderRule.update({
        where: { id: existing.id },
        data: data as Prisma.AppointmentReminderRuleUpdateInput,
      });
    } else {
      await prisma.appointmentReminderRule.create({
        data: data as Prisma.AppointmentReminderRuleCreateInput,
      });
    }
  } catch (err: unknown) {
    if (isPrismaUnknownArgumentError(err, "templateName")) delete data.templateName;
    if (isPrismaUnknownArgumentError(err, "timingType")) delete data.timingType;
    if (isPrismaUnknownArgumentError(err, "timeOfDayMinutes")) delete data.timeOfDayMinutes;

    if (payload.ruleId) {
      await prisma.appointmentReminderRule.update({
        where: { id: payload.ruleId },
        data: data as Prisma.AppointmentReminderRuleUpdateInput,
      });
      return;
    }

    const existing = await prisma.appointmentReminderRule.findFirst();
    if (existing) {
      await prisma.appointmentReminderRule.update({
        where: { id: existing.id },
        data: data as Prisma.AppointmentReminderRuleUpdateInput,
      });
    } else {
      await prisma.appointmentReminderRule.create({
        data: data as Prisma.AppointmentReminderRuleCreateInput,
      });
    }
  }
}

export async function createScheduledRecallRecord(payload: ScheduledRecallPayload) {
  await prisma.recall.create({
    data: {
      patientId: payload.patientId,
      ruleId: payload.ruleId,
      dueAt: payload.dueAt,
      status: RecallStatus.PENDING,
      notes: payload.notes,
    },
  });
}

export async function deleteRecallRuleRecord(ruleId: string) {
  await prisma.$transaction([
    prisma.recall.deleteMany({ where: { ruleId } }),
    prisma.recallRule.delete({ where: { id: ruleId } }),
  ]);
}

export async function deleteScheduledRecallRecord(recallId: string) {
  await prisma.recall.delete({ where: { id: recallId } });
}

export async function upsertRecurringMessageConfigRecord(payload: RecurringMessagePayload) {
  await prisma.recurringMessageConfig.upsert({
    where: { kind: payload.kind },
    create: {
      kind: payload.kind,
      enabled: payload.enabled,
      subject: payload.subject,
      body: payload.body,
      daysBefore: payload.daysBefore ?? undefined,
    },
    update: {
      enabled: payload.enabled,
      subject: payload.subject,
      body: payload.body,
      daysBefore: payload.daysBefore ?? undefined,
    },
  });
}

export async function loadManualNotificationRecipient(payload: ManualNotificationPayload) {
  if (payload.notificationType === "appointment") {
    if (!payload.appointmentId) throw new Error("Seleziona un appuntamento.");
    const appointment = await prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!appointment) throw new Error("Appuntamento non trovato.");
    return {
      patient: appointment.patient,
      eventLabel: appointment.title || "Appuntamento",
      eventDate: appointment.startsAt,
      emailSubject: payload.emailSubject || "Promemoria appuntamento",
      message: payload.message,
    };
  }

  if (!payload.patientId) throw new Error("Seleziona un paziente.");
  const patient = await prisma.patient.findUnique({
    where: { id: payload.patientId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  if (!patient) throw new Error("Paziente non trovato.");

  const eventLabel = payload.eventTitle || "Evento";
  const emailSubject = payload.emailSubject || (payload.eventTitle ? `Promemoria ${payload.eventTitle}` : "Promemoria evento");
  return {
    patient,
    eventLabel,
    eventDate: payload.eventAt,
    emailSubject,
    message: payload.message,
  };
}

export function buildManualNotificationMessage(params: {
  patientFirstName: string | null;
  patientLastName: string | null;
  eventLabel: string;
  eventDate: Date | null;
  message: string;
}) {
  if (params.message) return params.message;
  if (!params.eventDate) throw new Error("Inserisci un messaggio.");
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(params.eventDate);
  const timeLabel = new Intl.DateTimeFormat("it-IT", {
    timeStyle: "short",
  }).format(params.eventDate);
  const name = `${params.patientLastName ?? ""} ${params.patientFirstName ?? ""}`.trim() || "paziente";
  return `Gentile ${name}, promemoria: ${params.eventLabel} il ${dateLabel} alle ${timeLabel}.`;
}

export async function buildManualNotificationContext(payload: ManualNotificationPayload) {
  const recipient = await loadManualNotificationRecipient(payload);
  if (payload.notificationType === "appointment") {
    return recipient;
  }

  if (!recipient.message && (!payload.eventTitle || !recipient.eventDate)) {
    throw new Error("Inserisci un messaggio o i dettagli dell'evento.");
  }

  return recipient;
}
