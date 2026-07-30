import {
  type FullPatientAttachmentCounts,
  isPatientEmptyShell,
  sumAttachmentScore,
} from "@/lib/patients/duplicate-attachments";
import { pickPatientToKeep } from "@/lib/patients/duplicate-cleanup";
import type {
  DuplicateMatchSignal,
  PotentialDuplicateGroup,
} from "@/lib/patients/duplicate-detection";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";

export type MergePatientSnapshot = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: string;
  notes: string | null;
  photoUrl: string | null;
  hasPaperConsentForRequired: boolean;
  taxId: string | null;
  createdAt: Date;
};

export type ClassifiedDuplicateGroup = {
  groupId: string;
  keepPatientId: string;
  deletePatientIds: string[];
  safe: boolean;
  autoEligible: boolean;
  strong: boolean;
  reason: string;
};

export type FieldFillPlan = {
  data: {
    email?: string;
    phone?: string;
    birthDate?: Date;
    photoUrl?: string;
    hasPaperConsentForRequired?: boolean;
    notes?: string | null;
    taxId?: string;
  };
  filledFields: string[];
};

function intersectionSize(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  let count = 0;
  for (const id of left) {
    if (rightSet.has(id)) count += 1;
  }
  return count;
}

/**
 * Strong identity for auto-merge:
 * - taxId signal covering >= 2 patients, or
 * - nameBirthDate plus phone/email where the two signals share >= 2 patient ids
 *   (kind co-presence alone is not enough — avoids chaining unrelated shells).
 */
export function hasStrongMatchSignal(signals: DuplicateMatchSignal[]): boolean {
  for (const signal of signals) {
    if (signal.kind === "taxId" && signal.patientIds.length >= 2) {
      return true;
    }
  }

  const nameBirthDateSignals = signals.filter((signal) => signal.kind === "nameBirthDate");
  const contactSignals = signals.filter(
    (signal) => signal.kind === "phone" || signal.kind === "email",
  );

  for (const nameSignal of nameBirthDateSignals) {
    for (const contactSignal of contactSignals) {
      if (intersectionSize(nameSignal.patientIds, contactSignal.patientIds) >= 2) {
        return true;
      }
    }
  }

  return false;
}

export function classifyDuplicateGroup(
  group: PotentialDuplicateGroup,
  countsByPatientId: Map<string, FullPatientAttachmentCounts>,
): ClassifiedDuplicateGroup {
  const { patientId: keepPatientId, reason } = pickPatientToKeep(group.patients, countsByPatientId);
  const deletePatientIds = group.patients.map((patient) => patient.id).filter((id) => id !== keepPatientId);
  // Fail closed: missing counts map entry is not treated as an empty shell.
  const safe =
    deletePatientIds.length > 0 &&
    deletePatientIds.every((id) => {
      const counts = countsByPatientId.get(id);
      if (!counts) return false;
      return isPatientEmptyShell(counts);
    });
  const strong = hasStrongMatchSignal(group.matchSignals);
  return {
    groupId: group.id,
    keepPatientId,
    deletePatientIds,
    safe,
    strong,
    autoEligible: safe && strong,
    reason,
  };
}

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it") || null;
}

function extractTaxId(snapshot: MergePatientSnapshot) {
  return normalizeTaxId(snapshot.taxId) || normalizeTaxId(parsePatientStructuredNotes(snapshot.notes).parsedTaxId);
}

function rebuildNotesFromSources(keeperNotes: string | null, loserNotesList: (string | null)[]): string | null {
  const keeperParsed = parsePatientStructuredNotes(keeperNotes);
  const existingLines = (keeperNotes ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const freeform = existingLines.filter(
    (line) =>
      !line.startsWith("Indirizzo:") &&
      !line.startsWith("Codice Fiscale:") &&
      !line.startsWith("Anamnesi:") &&
      !line.startsWith("Farmaci:") &&
      !line.startsWith("Note aggiuntive:") &&
      !line.startsWith("Note:"),
  );

  let address = keeperParsed.parsedAddress;
  let city = keeperParsed.parsedCity;
  let taxId = keeperParsed.parsedTaxId;
  let conditions = keeperParsed.parsedConditions;
  let medications = keeperParsed.parsedMedications;
  let extra = keeperParsed.parsedExtra;

  for (const notes of loserNotesList) {
    const parsed = parsePatientStructuredNotes(notes);
    if (!address && parsed.parsedAddress) address = parsed.parsedAddress;
    if (!city && parsed.parsedCity) city = parsed.parsedCity;
    if (!taxId && parsed.parsedTaxId) taxId = parsed.parsedTaxId;
    if (conditions.length === 0 && parsed.parsedConditions.length) conditions = parsed.parsedConditions;
    if (!medications && parsed.parsedMedications) medications = parsed.parsedMedications;
    if (!extra && parsed.parsedExtra) extra = parsed.parsedExtra;

    const loserLines = (notes ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of loserLines) {
      const isStructured =
        line.startsWith("Indirizzo:") ||
        line.startsWith("Codice Fiscale:") ||
        line.startsWith("Anamnesi:") ||
        line.startsWith("Farmaci:") ||
        line.startsWith("Note aggiuntive:") ||
        line.startsWith("Note:");
      if (!isStructured && !freeform.includes(line)) {
        freeform.push(line);
      }
    }
  }

  const structured = [
    address || city ? `Indirizzo: ${address || "—"}${city ? `, ${city}` : ""}` : null,
    taxId ? `Codice Fiscale: ${taxId}` : null,
    conditions.length ? `Anamnesi: ${conditions.join(", ")}` : null,
    medications ? `Farmaci: ${medications}` : null,
    extra ? `Note aggiuntive: ${extra}` : null,
  ].filter(Boolean) as string[];

  const combined = [...freeform, ...structured].join("\n");
  return combined || null;
}

export function buildFieldFillPlan(
  keeper: MergePatientSnapshot,
  losers: MergePatientSnapshot[],
): FieldFillPlan {
  const orderedLosers = [...losers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const data: FieldFillPlan["data"] = {};
  const filledFields: string[] = [];

  if (!keeper.email) {
    const email = orderedLosers.map((loser) => loser.email?.trim().toLowerCase()).find(Boolean);
    if (email) {
      data.email = email;
      filledFields.push("email");
    }
  }

  if (!keeper.phone) {
    const phone = orderedLosers.map((loser) => loser.phone).find(Boolean);
    if (phone) {
      data.phone = phone;
      filledFields.push("phone");
    }
  }

  if (!keeper.birthDate) {
    const birthDate = orderedLosers.map((loser) => loser.birthDate).find(Boolean);
    if (birthDate) {
      data.birthDate = birthDate;
      filledFields.push("birthDate");
    }
  }

  if (!keeper.photoUrl) {
    const photoUrl = orderedLosers.map((loser) => loser.photoUrl).find(Boolean);
    if (photoUrl) {
      data.photoUrl = photoUrl;
      filledFields.push("photoUrl");
    }
  }

  if (!keeper.hasPaperConsentForRequired && orderedLosers.some((loser) => loser.hasPaperConsentForRequired)) {
    data.hasPaperConsentForRequired = true;
    filledFields.push("hasPaperConsentForRequired");
  }

  const keeperTaxId = extractTaxId(keeper);
  if (!keeperTaxId) {
    const taxId = orderedLosers.map((loser) => extractTaxId(loser)).find(Boolean) ?? null;
    if (taxId) {
      data.taxId = taxId;
      filledFields.push("codiceFiscale");
    }
  }

  const nextNotes = rebuildNotesFromSources(
    keeper.notes,
    orderedLosers.map((loser) => loser.notes),
  );
  let notesChanged = (nextNotes ?? "") !== (keeper.notes ?? "");
  if (notesChanged) {
    data.notes = nextNotes;
  }

  // Ensure CF is written into notes when we only set taxId column
  if (data.taxId && !data.notes) {
    const withCf = rebuildNotesFromSources(keeper.notes, [
      ...orderedLosers.map((loser) => loser.notes),
      `Codice Fiscale: ${data.taxId}`,
    ]);
    if ((withCf ?? "") !== (keeper.notes ?? "")) {
      data.notes = withCf;
      notesChanged = true;
    }
  }

  // Always surface note rewrites in the preview/audit field list.
  if (notesChanged && !filledFields.includes("notes") && !filledFields.includes("codiceFiscale")) {
    filledFields.push("notes");
  } else if (notesChanged && !filledFields.includes("notes") && filledFields.includes("codiceFiscale")) {
    const keeperParsed = parsePatientStructuredNotes(keeper.notes);
    const nextParsed = parsePatientStructuredNotes(data.notes ?? nextNotes);
    if (
      keeperParsed.parsedAddress !== nextParsed.parsedAddress ||
      keeperParsed.parsedCity !== nextParsed.parsedCity ||
      keeperParsed.parsedMedications !== nextParsed.parsedMedications ||
      keeperParsed.parsedExtra !== nextParsed.parsedExtra ||
      keeperParsed.parsedConditions.join(",") !== nextParsed.parsedConditions.join(",") ||
      (data.notes ?? nextNotes ?? "").split("\n").length !== (keeper.notes ?? "").split("\n").length
    ) {
      filledFields.push("notes");
    }
  }

  return { data, filledFields: Array.from(new Set(filledFields)) };
}

export function formatAttachmentSummary(counts: FullPatientAttachmentCounts): string {
  const parts = [
    counts.paymentCount > 0 ? `${counts.paymentCount} pagamenti` : null,
    counts.appointmentCount > 0 ? `${counts.appointmentCount} appuntamenti` : null,
    counts.dentalRecordCount > 0 ? `${counts.dentalRecordCount} record clinici` : null,
    counts.quoteCount > 0 ? `${counts.quoteCount} preventivi` : null,
    counts.consentCount > 0 ? `${counts.consentCount} consensi` : null,
  ].filter(Boolean);
  if (parts.length === 0 && sumAttachmentScore(counts) > 0) {
    return `${sumAttachmentScore(counts)} collegamenti`;
  }
  return parts.join(", ");
}
