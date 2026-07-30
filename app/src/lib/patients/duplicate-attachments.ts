import { prisma } from "@/lib/prisma";

export type FullPatientAttachmentCounts = {
  appointmentCount: number;
  appointmentReminderCount: number;
  paymentCount: number;
  quoteCount: number;
  cashAdvanceCount: number;
  financeEntryCount: number;
  dentalRecordCount: number;
  clinicalNoteCount: number;
  consentCount: number;
  recallCount: number;
  recurringMessageLogCount: number;
  stockMovementCount: number;
  smsLogCount: number;
};

export const EMPTY_ATTACHMENT_COUNTS: FullPatientAttachmentCounts = {
  appointmentCount: 0,
  appointmentReminderCount: 0,
  paymentCount: 0,
  quoteCount: 0,
  cashAdvanceCount: 0,
  financeEntryCount: 0,
  dentalRecordCount: 0,
  clinicalNoteCount: 0,
  consentCount: 0,
  recallCount: 0,
  recurringMessageLogCount: 0,
  stockMovementCount: 0,
  smsLogCount: 0,
};

export function sumAttachmentScore(counts: FullPatientAttachmentCounts): number {
  return (
    counts.appointmentCount +
    counts.appointmentReminderCount +
    counts.paymentCount +
    counts.quoteCount +
    counts.cashAdvanceCount +
    counts.financeEntryCount +
    counts.dentalRecordCount +
    counts.clinicalNoteCount +
    counts.consentCount +
    counts.recallCount +
    counts.recurringMessageLogCount +
    counts.stockMovementCount +
    counts.smsLogCount
  );
}

export function isPatientEmptyShell(counts: FullPatientAttachmentCounts): boolean {
  return sumAttachmentScore(counts) === 0;
}

export function toLegacyAttachmentCounts(full: FullPatientAttachmentCounts): {
  paymentCount: number;
  dentalRecordCount: number;
} {
  return {
    paymentCount: full.paymentCount,
    dentalRecordCount: full.dentalRecordCount,
  };
}

type CountGroup = { patientId: string | null; _count: { _all: number } };

function applyGroups(
  counts: Map<string, FullPatientAttachmentCounts>,
  groups: CountGroup[],
  key: keyof FullPatientAttachmentCounts,
) {
  for (const group of groups) {
    if (!group.patientId) continue;
    const entry = counts.get(group.patientId);
    if (entry) {
      entry[key] = group._count._all;
    }
  }
}

export async function loadFullAttachmentCounts(
  patientIds: string[],
): Promise<Map<string, FullPatientAttachmentCounts>> {
  const counts = new Map<string, FullPatientAttachmentCounts>();
  for (const patientId of patientIds) {
    counts.set(patientId, { ...EMPTY_ATTACHMENT_COUNTS });
  }

  if (patientIds.length === 0) {
    return counts;
  }

  const whereIn = { patientId: { in: patientIds } };

  const [
    appointments,
    appointmentReminders,
    payments,
    quotes,
    cashAdvances,
    financeEntries,
    dentalRecords,
    clinicalNotes,
    consents,
    recalls,
    recurringLogs,
    stockMovements,
    smsLogs,
  ] = await Promise.all([
    prisma.appointment.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.appointmentReminder.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.patientPayment.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.quote.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.cashAdvance.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.financeEntry.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds } },
      _count: { _all: true },
    }),
    prisma.dentalRecord.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.clinicalNote.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.patientConsent.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.recall.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.recurringMessageLog.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
    prisma.stockMovement.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds } },
      _count: { _all: true },
    }),
    prisma.smsLog.groupBy({ by: ["patientId"], where: whereIn, _count: { _all: true } }),
  ]);

  applyGroups(counts, appointments, "appointmentCount");
  applyGroups(counts, appointmentReminders, "appointmentReminderCount");
  applyGroups(counts, payments, "paymentCount");
  applyGroups(counts, quotes, "quoteCount");
  applyGroups(counts, cashAdvances, "cashAdvanceCount");
  applyGroups(counts, financeEntries as CountGroup[], "financeEntryCount");
  applyGroups(counts, dentalRecords, "dentalRecordCount");
  applyGroups(counts, clinicalNotes, "clinicalNoteCount");
  applyGroups(counts, consents, "consentCount");
  applyGroups(counts, recalls, "recallCount");
  applyGroups(counts, recurringLogs, "recurringMessageLogCount");
  applyGroups(counts, stockMovements as CountGroup[], "stockMovementCount");
  applyGroups(counts, smsLogs, "smsLogCount");

  return counts;
}
