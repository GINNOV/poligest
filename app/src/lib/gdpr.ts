import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GDPR_RETENTION_DAYS = {
  auditLogs: 730,
  smsLogs: 365,
  recurringMessageLogs: 365,
  appointmentReminders: 365,
} as const;

export function buildRetentionCutoff(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

export async function buildPatientExport(patientId: string) {
  const [
    patient,
    consents,
    appointments,
    appointmentReminders,
    clinicalNotes,
    dentalRecords,
    recalls,
    recurringMessageLogs,
    stockMovements,
    smsLogs,
    cashAdvances,
    quotes,
  ] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.patientConsent.findMany({
      where: { patientId },
      include: { module: true },
      orderBy: { givenAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { patientId },
      include: { doctor: { select: { fullName: true, specialty: true } } },
      orderBy: { startsAt: "desc" },
    }),
    prisma.appointmentReminder.findMany({
      where: { patientId },
      include: { rule: true, appointment: true },
      orderBy: { dueAt: "desc" },
    }),
    prisma.clinicalNote.findMany({
      where: { patientId },
      include: { doctor: { select: { fullName: true, specialty: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dentalRecord.findMany({
      where: { patientId },
      include: { updatedBy: { select: { name: true, email: true } } },
      orderBy: { performedAt: "desc" },
    }),
    prisma.recall.findMany({
      where: { patientId },
      include: { rule: true },
      orderBy: { dueAt: "desc" },
    }),
    prisma.recurringMessageLog.findMany({
      where: { patientId },
      orderBy: { scheduledFor: "desc" },
    }),
    prisma.stockMovement.findMany({
      where: { patientId },
      include: { product: { include: { supplier: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.smsLog.findMany({
      where: { patientId },
      include: { template: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cashAdvance.findMany({
      where: { patientId },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.quote.findMany({
      where: { patientId },
      include: { items: true, service: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    patient,
    consents,
    appointments,
    appointmentReminders,
    clinicalNotes,
    dentalRecords,
    recalls,
    recurringMessageLogs,
    stockMovements,
    smsLogs,
    cashAdvances,
    quotes,
  };
}

export async function applyRetentionCleanup() {
  const auditCutoff = buildRetentionCutoff(GDPR_RETENTION_DAYS.auditLogs);
  const smsCutoff = buildRetentionCutoff(GDPR_RETENTION_DAYS.smsLogs);
  const recurringCutoff = buildRetentionCutoff(GDPR_RETENTION_DAYS.recurringMessageLogs);
  const reminderCutoff = buildRetentionCutoff(GDPR_RETENTION_DAYS.appointmentReminders);

  const [auditLogs, smsLogs, recurringLogs, appointmentReminders] = await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
    prisma.smsLog.deleteMany({ where: { createdAt: { lt: smsCutoff } } }),
    prisma.recurringMessageLog.deleteMany({ where: { createdAt: { lt: recurringCutoff } } }),
    prisma.appointmentReminder.deleteMany({ where: { createdAt: { lt: reminderCutoff } } }),
  ]);

  return {
    auditLogs: auditLogs.count,
    smsLogs: smsLogs.count,
    recurringMessageLogs: recurringLogs.count,
    appointmentReminders: appointmentReminders.count,
  };
}
