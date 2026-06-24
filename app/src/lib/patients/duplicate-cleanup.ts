import type { DuplicatePatientRecord, PotentialDuplicateGroup } from "@/lib/patients/duplicate-detection";

export type PatientAttachmentCounts = {
  paymentCount: number;
  dentalRecordCount: number;
};

export type DuplicateCleanupAction = {
  groupId: string;
  keepPatientId: string;
  deletePatientIds: string[];
  reason: string;
};

function getCompletenessScore(patient: DuplicatePatientRecord) {
  let score = 0;
  if (patient.email) score += 1;
  if (patient.phone) score += 1;
  if (patient.birthDate) score += 1;
  if (patient.taxId) score += 1;
  return score;
}

function formatPatientLabel(patient: DuplicatePatientRecord) {
  return `${patient.lastName ?? ""} ${patient.firstName ?? ""}`.trim() || patient.id;
}

export function pickPatientToKeep(
  patients: DuplicatePatientRecord[],
  attachmentCountsByPatientId: Map<string, PatientAttachmentCounts>,
): { patientId: string; reason: string } {
  if (patients.length === 0) {
    throw new Error("Cannot pick a keeper from an empty duplicate group");
  }

  const ranked = [...patients].sort((left, right) => {
    const leftCounts = attachmentCountsByPatientId.get(left.id) ?? {
      paymentCount: 0,
      dentalRecordCount: 0,
    };
    const rightCounts = attachmentCountsByPatientId.get(right.id) ?? {
      paymentCount: 0,
      dentalRecordCount: 0,
    };

    const leftAttachmentScore = leftCounts.paymentCount + leftCounts.dentalRecordCount;
    const rightAttachmentScore = rightCounts.paymentCount + rightCounts.dentalRecordCount;
    const leftHasAttachments = leftAttachmentScore > 0;
    const rightHasAttachments = rightAttachmentScore > 0;

    if (leftHasAttachments !== rightHasAttachments) {
      return leftHasAttachments ? -1 : 1;
    }
    if (leftAttachmentScore !== rightAttachmentScore) {
      return rightAttachmentScore - leftAttachmentScore;
    }

    const completenessDelta = getCompletenessScore(right) - getCompletenessScore(left);
    if (completenessDelta !== 0) {
      return completenessDelta;
    }

    const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return left.id.localeCompare(right.id);
  });

  const keeper = ranked[0];
  const counts = attachmentCountsByPatientId.get(keeper.id) ?? {
    paymentCount: 0,
    dentalRecordCount: 0,
  };
  const attachmentScore = counts.paymentCount + counts.dentalRecordCount;

  let reason = "scheda piu completa";
  if (attachmentScore > 0) {
    const details = [
      counts.paymentCount > 0 ? `${counts.paymentCount} pagamenti` : null,
      counts.dentalRecordCount > 0 ? `${counts.dentalRecordCount} record clinici` : null,
    ]
      .filter(Boolean)
      .join(", ");
    reason = `ha dati collegati (${details})`;
  }

  return {
    patientId: keeper.id,
    reason: `${formatPatientLabel(keeper)}: ${reason}`,
  };
}

export function buildDuplicateCleanupPlan(
  groups: PotentialDuplicateGroup[],
  attachmentCountsByPatientId: Map<string, PatientAttachmentCounts>,
): DuplicateCleanupAction[] {
  return groups
    .filter((group) => group.patients.length > 1)
    .map((group) => {
      const { patientId, reason } = pickPatientToKeep(group.patients, attachmentCountsByPatientId);
      return {
        groupId: group.id,
        keepPatientId: patientId,
        deletePatientIds: group.patients
          .map((patient) => patient.id)
          .filter((id) => id !== patientId),
        reason,
      };
    });
}