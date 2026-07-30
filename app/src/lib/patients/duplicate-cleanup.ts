import type { DuplicatePatientRecord, PotentialDuplicateGroup } from "@/lib/patients/duplicate-detection";
import {
  EMPTY_ATTACHMENT_COUNTS,
  type FullPatientAttachmentCounts,
  sumAttachmentScore,
} from "@/lib/patients/duplicate-attachments";

export type PatientAttachmentCounts = FullPatientAttachmentCounts;

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

function formatAttachmentDetails(counts: FullPatientAttachmentCounts): string {
  return [
    counts.paymentCount > 0 ? `${counts.paymentCount} pagamenti` : null,
    counts.appointmentCount > 0 ? `${counts.appointmentCount} appuntamenti` : null,
    counts.dentalRecordCount > 0 ? `${counts.dentalRecordCount} record clinici` : null,
    counts.quoteCount > 0 ? `${counts.quoteCount} preventivi` : null,
    counts.clinicalNoteCount > 0 ? `${counts.clinicalNoteCount} note cliniche` : null,
    counts.consentCount > 0 ? `${counts.consentCount} consensi` : null,
    counts.recallCount > 0 ? `${counts.recallCount} richiami` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function pickPatientToKeep(
  patients: DuplicatePatientRecord[],
  attachmentCountsByPatientId: Map<string, PatientAttachmentCounts>,
): { patientId: string; reason: string } {
  if (patients.length === 0) {
    throw new Error("Cannot pick a keeper from an empty duplicate group");
  }

  const ranked = [...patients].sort((left, right) => {
    const leftCounts =
      attachmentCountsByPatientId.get(left.id) ?? EMPTY_ATTACHMENT_COUNTS;
    const rightCounts =
      attachmentCountsByPatientId.get(right.id) ?? EMPTY_ATTACHMENT_COUNTS;

    const leftAttachmentScore = sumAttachmentScore(leftCounts);
    const rightAttachmentScore = sumAttachmentScore(rightCounts);
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
  const counts = attachmentCountsByPatientId.get(keeper.id) ?? EMPTY_ATTACHMENT_COUNTS;
  const attachmentScore = sumAttachmentScore(counts);

  let reason = "scheda piu completa";
  if (attachmentScore > 0) {
    const details = formatAttachmentDetails(counts);
    reason = details
      ? `ha dati collegati (${details})`
      : "ha dati collegati";
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
