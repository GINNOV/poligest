import { Role, type Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  loadFullAttachmentCounts,
  isPatientEmptyShell,
} from "@/lib/patients/duplicate-attachments";
import { findPotentialPatientDuplicates } from "@/lib/patients/duplicate-detection";
import {
  buildFieldFillPlan,
  classifyDuplicateGroup,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";
import { deletePatientWithRelations } from "@/lib/patients/delete-patient";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { prisma } from "@/lib/prisma";

export type MergeTrigger = "ui" | "bulk" | "cron";

export type MergeEmptyShellsInput = {
  keepPatientId: string;
  deletePatientIds: string[];
  actor: { id: string; role: Role } | null;
  trigger: MergeTrigger;
  requireStrong?: boolean;
};

export type MergeEmptyShellsResult =
  | { ok: true; keepPatientId: string; deletedPatientIds: string[]; filledFields: string[] }
  | {
      ok: false;
      error: string;
      code: "NOT_FOUND" | "NOT_EMPTY" | "NOT_SAFE" | "NOT_STRONG" | "INVALID";
    };

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it") || null;
}

function toSnapshot(patient: {
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
  taxId?: string | null;
  createdAt: Date;
}): MergePatientSnapshot {
  const fromColumn = normalizeTaxId(patient.taxId);
  const fromNotes = normalizeTaxId(parsePatientStructuredNotes(patient.notes).parsedTaxId);
  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phone,
    birthDate: patient.birthDate,
    gender: patient.gender,
    notes: patient.notes,
    photoUrl: patient.photoUrl,
    hasPaperConsentForRequired: patient.hasPaperConsentForRequired,
    taxId: fromColumn || fromNotes,
    createdAt: patient.createdAt,
  };
}

const patientSelect = {
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
  taxId: true,
  createdAt: true,
} as const;

export async function mergeEmptyDuplicateShells(
  input: MergeEmptyShellsInput,
): Promise<MergeEmptyShellsResult> {
  const keepPatientId = input.keepPatientId?.trim();
  const deletePatientIds = Array.from(
    new Set((input.deletePatientIds ?? []).map((id) => id.trim()).filter(Boolean)),
  );

  if (!keepPatientId || deletePatientIds.length === 0) {
    return { ok: false, error: "Parametri merge non validi", code: "INVALID" };
  }
  if (deletePatientIds.includes(keepPatientId)) {
    return { ok: false, error: "La scheda da mantenere non può essere eliminata", code: "INVALID" };
  }

  const allIds = [keepPatientId, ...deletePatientIds];
  const counts = await loadFullAttachmentCounts(allIds);

  for (const id of deletePatientIds) {
    const entry = counts.get(id);
    if (!entry || !isPatientEmptyShell(entry)) {
      return {
        ok: false,
        error: "Una o più schede da unire non sono vuote",
        code: "NOT_EMPTY",
      };
    }
  }

  const patients = await prisma.patient.findMany({
    where: { id: { in: allIds } },
    select: patientSelect,
  });

  if (patients.length !== allIds.length) {
    return { ok: false, error: "Una o più schede non sono state trovate", code: "NOT_FOUND" };
  }

  if (input.requireStrong) {
    const groups = findPotentialPatientDuplicates(
      patients.map((patient) => ({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        notes: patient.notes,
        createdAt: patient.createdAt,
        taxId: patient.taxId,
      })),
    );
    const group = groups.find(
      (candidate) =>
        candidate.patients.some((p) => p.id === keepPatientId) &&
        deletePatientIds.every((id) => candidate.patients.some((p) => p.id === id)),
    );
    if (!group) {
      return { ok: false, error: "Gruppo non eleggibile per auto-merge", code: "NOT_STRONG" };
    }
    const classification = classifyDuplicateGroup(group, counts);
    if (!classification.autoEligible || classification.keepPatientId !== keepPatientId) {
      return { ok: false, error: "Gruppo non eleggibile per auto-merge", code: "NOT_STRONG" };
    }
  }

  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const keeperRow = byId.get(keepPatientId)!;
  const loserRows = deletePatientIds.map((id) => byId.get(id)!);
  const fillPlan = buildFieldFillPlan(toSnapshot(keeperRow), loserRows.map(toSnapshot));

  await prisma.$transaction(async (tx) => {
    if (Object.keys(fillPlan.data).length > 0) {
      const updateData: Prisma.PatientUpdateInput = {};
      if (fillPlan.data.email !== undefined) updateData.email = fillPlan.data.email;
      if (fillPlan.data.phone !== undefined) updateData.phone = fillPlan.data.phone;
      if (fillPlan.data.birthDate !== undefined) updateData.birthDate = fillPlan.data.birthDate;
      if (fillPlan.data.photoUrl !== undefined) updateData.photoUrl = fillPlan.data.photoUrl;
      if (fillPlan.data.hasPaperConsentForRequired !== undefined) {
        updateData.hasPaperConsentForRequired = fillPlan.data.hasPaperConsentForRequired;
      }
      if (fillPlan.data.notes !== undefined) updateData.notes = fillPlan.data.notes;
      if (fillPlan.data.taxId !== undefined) updateData.taxId = fillPlan.data.taxId;

      await tx.patient.update({
        where: { id: keepPatientId },
        data: updateData,
      });
    }

    for (const patientId of deletePatientIds) {
      await deletePatientWithRelations(patientId, tx);
    }
  });

  const action =
    input.trigger === "cron" ? "patient.duplicates_auto_merged" : "patient.duplicates_merged";

  await logAudit(input.actor, {
    action,
    entity: "Patient",
    entityId: keepPatientId,
    metadata: {
      keptPatientId: keepPatientId,
      deletedPatientIds: deletePatientIds,
      filledFields: fillPlan.filledFields,
      trigger: input.trigger,
    },
  });

  return {
    ok: true,
    keepPatientId,
    deletedPatientIds: deletePatientIds,
    filledFields: fillPlan.filledFields,
  };
}

export async function mergeAllSafeEmptyShellGroups(options: {
  actor: { id: string; role: Role } | null;
  trigger: MergeTrigger;
  autoEligibleOnly: boolean;
}): Promise<{ merged: number; deleted: number; skipped: number; errors: string[] }> {
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      notes: true,
      taxId: true,
      createdAt: true,
    },
  });

  const groups = findPotentialPatientDuplicates(
    patients.map((patient) => ({
      ...patient,
      notes: patient.notes,
    })),
  );

  const duplicateIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const counts = await loadFullAttachmentCounts(duplicateIds);

  let merged = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const group of groups) {
    const classification = classifyDuplicateGroup(group, counts);
    const eligible = options.autoEligibleOnly ? classification.autoEligible : classification.safe;
    if (!eligible) {
      skipped += 1;
      continue;
    }

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: classification.keepPatientId,
      deletePatientIds: classification.deletePatientIds,
      actor: options.actor,
      trigger: options.trigger,
      requireStrong: options.autoEligibleOnly,
    });

    if (result.ok) {
      merged += 1;
      deleted += result.deletedPatientIds.length;
      // Remove merged shells from counts map so later overlapping work is consistent
      for (const id of result.deletedPatientIds) {
        counts.delete(id);
      }
    } else {
      skipped += 1;
      errors.push(`${classification.groupId}: ${result.error}`);
    }
  }

  return { merged, deleted, skipped, errors };
}
