import { Prisma, RecallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AppointmentReminderRulePayload,
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

export async function markRecallAsContactedRecord(recallId: string) {
  await prisma.recall.update({
    where: { id: recallId },
    data: {
      status: RecallStatus.CONTACTED,
      lastContactAt: new Date(),
      deliveryFailureDismissedAt: null,
    },
  });
}

export async function dismissRecallDeliveryFailureRecord(recallId: string) {
  await prisma.recall.updateMany({
    where: { id: recallId, status: RecallStatus.SKIPPED },
    data: { deliveryFailureDismissedAt: new Date() },
  });
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
