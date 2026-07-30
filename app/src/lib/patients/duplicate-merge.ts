import { logAudit } from "@/lib/audit";
import {
  EMPTY_ATTACHMENT_COUNTS,
  isPatientEmptyShell,
  loadFullAttachmentCounts,
} from "@/lib/patients/duplicate-attachments";
import {
  buildFieldFillPlan,
  hasStrongMatchSignal,
  classifyDuplicateGroup,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";
import {
  findPotentialPatientDuplicates,
  type DuplicatePatientInput,
} from "@/lib/patients/duplicate-detection";
import { deletePatientWithRelations } from "@/lib/patients/delete-patient";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { prisma } from "@/lib/prisma";

export type MergeTrigger = "ui" | "bulk" | "cron";

export type MergeAuditActor = Parameters<typeof logAudit>[0];

export type MergeEmptyShellsInput = {
  keepPatientId: string;
  deletePatientIds: string[];
  actor: MergeAuditActor;
  trigger: MergeTrigger;
  /** When true (cron / auto-eligible bulk), require a strong match signal among the set. */
  requireStrong?: boolean;
};

export type MergeEmptyShellsResult =
  | {
      ok: true;
      keepPatientId: string;
      deletedPatientIds: string[];
      filledFields: string[];
    }
  | {
      ok: false;
      error: string;
      code: "NOT_FOUND" | "NOT_EMPTY" | "NOT_SAFE" | "NOT_STRONG" | "INVALID";
    };

const PATIENT_MERGE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  birthDate: true,
  gender: true,
  notes: true,
  photoUrl: true,
  hasPaperConsentForRequired: true,
  createdAt: true,
} as const;

type PatientMergeRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: string;
  notes: string | null;
  photoUrl: string | null;
  hasPaperConsentForRequired: boolean;
  createdAt: Date;
};

function toDuplicateInput(row: PatientMergeRow): DuplicatePatientInput {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    birthDate: row.birthDate,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function toMergeSnapshot(row: PatientMergeRow): MergePatientSnapshot {
  const parsed = parsePatientStructuredNotes(row.notes);
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    birthDate: row.birthDate,
    gender: row.gender,
    notes: row.notes,
    photoUrl: row.photoUrl,
    hasPaperConsentForRequired: row.hasPaperConsentForRequired,
    taxId: parsed.parsedTaxId.trim() || null,
    createdAt: row.createdAt,
  };
}

function normalizeDeleteIds(keepPatientId: string, deletePatientIds: string[]): string[] | null {
  const unique = Array.from(new Set(deletePatientIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return null;
  if (unique.includes(keepPatientId)) return null;
  return unique;
}

function hasStrongSignalForMergeSet(
  patients: PatientMergeRow[],
  keepPatientId: string,
  deletePatientIds: string[],
): boolean {
  const groups = findPotentialPatientDuplicates(patients.map(toDuplicateInput));
  const targetIds = [keepPatientId, ...deletePatientIds];

  return groups.some((group) => {
    const groupIds = new Set(group.patients.map((patient) => patient.id));
    const coversAll = targetIds.every((id) => groupIds.has(id));
    return coversAll && hasStrongMatchSignal(group.matchSignals);
  });
}

export async function mergeEmptyDuplicateShells(
  input: MergeEmptyShellsInput,
): Promise<MergeEmptyShellsResult> {
  const keepPatientId = input.keepPatientId.trim();
  if (!keepPatientId) {
    return { ok: false, error: "keepPatientId is required", code: "INVALID" };
  }

  const deletePatientIds = normalizeDeleteIds(keepPatientId, input.deletePatientIds);
  if (!deletePatientIds) {
    return {
      ok: false,
      error: "deletePatientIds must be non-empty and must not include keepPatientId",
      code: "INVALID",
    };
  }

  const allIds = [keepPatientId, ...deletePatientIds];
  const countsByPatientId = await loadFullAttachmentCounts(allIds);

  for (const deleteId of deletePatientIds) {
    const counts = countsByPatientId.get(deleteId) ?? EMPTY_ATTACHMENT_COUNTS;
    if (!isPatientEmptyShell(counts)) {
      return {
        ok: false,
        error: `Patient ${deleteId} is not an empty shell and cannot be deleted by merge`,
        code: "NOT_EMPTY",
      };
    }
  }

  const rows = (await prisma.patient.findMany({
    where: { id: { in: allIds } },
    select: PATIENT_MERGE_SELECT,
  })) as PatientMergeRow[];

  const rowById = new Map(rows.map((row) => [row.id, row]));
  if (!rowById.has(keepPatientId) || deletePatientIds.some((id) => !rowById.has(id))) {
    return {
      ok: false,
      error: "One or more patients were not found",
      code: "NOT_FOUND",
    };
  }

  const orderedRows = allIds.map((id) => rowById.get(id)!);

  if (input.requireStrong) {
    if (!hasStrongSignalForMergeSet(orderedRows, keepPatientId, deletePatientIds)) {
      return {
        ok: false,
        error: "Merge set does not have a strong identity match signal",
        code: "NOT_STRONG",
      };
    }
  }

  const keeper = toMergeSnapshot(rowById.get(keepPatientId)!);
  const losers = deletePatientIds
    .map((id) => toMergeSnapshot(rowById.get(id)!))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  const fieldFillPlan = buildFieldFillPlan(keeper, losers);

  await prisma.$transaction(async (tx) => {
    if (fieldFillPlan.filledFields.length > 0) {
      await tx.patient.update({
        where: { id: keepPatientId },
        data: fieldFillPlan.data,
      });
    }

    for (const deleteId of deletePatientIds) {
      await deletePatientWithRelations(deleteId, tx);
    }
  });

  const action =
    input.trigger === "cron" ? "patient.duplicates_auto_merged" : "patient.duplicates_merged";

  await logAudit(input.actor, {
    action,
    entity: "Patient",
    entityId: keepPatientId,
    metadata: {
      kept: keepPatientId,
      deleted: deletePatientIds,
      filledFields: fieldFillPlan.filledFields,
      trigger: input.trigger,
    },
  });

  return {
    ok: true,
    keepPatientId,
    deletedPatientIds: deletePatientIds,
    filledFields: fieldFillPlan.filledFields,
  };
}

export async function mergeAllSafeEmptyShellGroups(options: {
  actor: MergeAuditActor;
  trigger: MergeTrigger;
  autoEligibleOnly: boolean;
}): Promise<{ merged: number; deleted: number; skipped: number; errors: string[] }> {
  const patients = (await prisma.patient.findMany({
    select: PATIENT_MERGE_SELECT,
  })) as PatientMergeRow[];

  const groups = findPotentialPatientDuplicates(patients.map(toDuplicateInput));
  if (groups.length === 0) {
    return { merged: 0, deleted: 0, skipped: 0, errors: [] };
  }

  const duplicateIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const countsByPatientId = await loadFullAttachmentCounts(duplicateIds);

  let merged = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const group of groups) {
    const classified = classifyDuplicateGroup(group, countsByPatientId);

    if (!classified.safe) {
      skipped += 1;
      continue;
    }
    if (options.autoEligibleOnly && !classified.autoEligible) {
      skipped += 1;
      continue;
    }
    if (classified.deletePatientIds.length === 0) {
      skipped += 1;
      continue;
    }

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: classified.keepPatientId,
      deletePatientIds: classified.deletePatientIds,
      actor: options.actor,
      trigger: options.trigger,
      requireStrong: options.autoEligibleOnly,
    });

    if (result.ok) {
      merged += 1;
      deleted += result.deletedPatientIds.length;
    } else {
      errors.push(`${classified.groupId}: ${result.error} (${result.code})`);
    }
  }

  return { merged, deleted, skipped, errors };
}
