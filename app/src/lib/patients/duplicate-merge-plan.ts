import {
  isPatientEmptyShell,
  type FullPatientAttachmentCounts,
} from "@/lib/patients/duplicate-attachments";
import { pickPatientToKeep } from "@/lib/patients/duplicate-cleanup";
import type {
  DuplicateMatchSignal,
  PotentialDuplicateGroup,
} from "@/lib/patients/duplicate-detection";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { isValidDate } from "@/lib/date";

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
    notes?: string;
  };
  filledFields: string[];
};

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

function patientIdSet(ids: string[]): Set<string> {
  return new Set(ids);
}

function intersectionSize(left: string[], right: string[]): number {
  const rightSet = patientIdSet(right);
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
  const { patientId: keepPatientId, reason } = pickPatientToKeep(
    group.patients,
    countsByPatientId,
  );
  const deletePatientIds = group.patients
    .map((patient) => patient.id)
    .filter((id) => id !== keepPatientId);

  // Fail closed: missing counts map entry is not an empty shell.
  const safe = deletePatientIds.every((id) => {
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
    autoEligible: safe && strong,
    strong,
    reason,
  };
}

type StructuredNoteParts = {
  address: string;
  city: string;
  taxId: string;
  conditions: string[];
  medications: string;
  extra: string;
};

const STRUCTURED_NOTE_PREFIXES = [
  "Indirizzo:",
  "Codice Fiscale:",
  "Anamnesi:",
  "Farmaci:",
  "Note aggiuntive:",
  "Note:",
] as const;

function isStructuredNoteLine(line: string): boolean {
  return STRUCTURED_NOTE_PREFIXES.some((prefix) => line.startsWith(prefix));
}

function extractFreeformLines(notes: string | null | undefined): string[] {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isStructuredNoteLine(line));
}

function extractStructuredParts(
  notes: string | null | undefined,
  taxIdFallback: string | null = null,
): StructuredNoteParts {
  const parsed = parsePatientStructuredNotes(notes);
  return {
    address: parsed.parsedAddress,
    city: parsed.parsedCity,
    taxId: parsed.parsedTaxId || (taxIdFallback ?? "").trim() || "",
    conditions: parsed.parsedConditions,
    medications: parsed.parsedMedications,
    extra: parsed.parsedExtra,
  };
}

function rebuildNotes(freeformLines: string[], parts: StructuredNoteParts): string | null {
  const structuredLines = [
    parts.address || parts.city
      ? `Indirizzo: ${parts.address || "—"}${parts.city ? `, ${parts.city}` : ""}`
      : null,
    parts.taxId ? `Codice Fiscale: ${parts.taxId}` : null,
    parts.conditions.length ? `Anamnesi: ${parts.conditions.join(", ")}` : null,
    parts.medications ? `Farmaci: ${parts.medications}` : null,
    parts.extra ? `Note aggiuntive: ${parts.extra}` : null,
  ].filter(Boolean) as string[];

  return [...freeformLines, ...structuredLines].join("\n") || null;
}

/**
 * Fill only empty keeper fields from losers (first non-empty wins).
 * Callers may pre-sort losers; this still prefers earlier createdAt when ties exist in input order.
 */
export function buildFieldFillPlan(
  keeper: MergePatientSnapshot,
  losers: MergePatientSnapshot[],
): FieldFillPlan {
  const orderedLosers = [...losers].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );

  const data: FieldFillPlan["data"] = {};
  const filledFields: string[] = [];

  if (isBlank(keeper.email)) {
    const email = orderedLosers.find((loser) => !isBlank(loser.email))?.email;
    if (email) {
      data.email = email;
      filledFields.push("email");
    }
  }

  if (isBlank(keeper.phone)) {
    const phone = orderedLosers.find((loser) => !isBlank(loser.phone))?.phone;
    if (phone) {
      data.phone = phone;
      filledFields.push("phone");
    }
  }

  if (!isValidDate(keeper.birthDate)) {
    const birthDate = orderedLosers.find((loser) => isValidDate(loser.birthDate))?.birthDate;
    if (birthDate) {
      data.birthDate = birthDate;
      filledFields.push("birthDate");
    }
  }

  if (isBlank(keeper.photoUrl)) {
    const photoUrl = orderedLosers.find((loser) => !isBlank(loser.photoUrl))?.photoUrl;
    if (photoUrl) {
      data.photoUrl = photoUrl;
      filledFields.push("photoUrl");
    }
  }

  if (!keeper.hasPaperConsentForRequired) {
    const hasConsent = orderedLosers.some((loser) => loser.hasPaperConsentForRequired);
    if (hasConsent) {
      data.hasPaperConsentForRequired = true;
      filledFields.push("hasPaperConsentForRequired");
    }
  }

  const mergedParts = extractStructuredParts(keeper.notes, keeper.taxId);
  let notesChanged = false;

  // Preserve keeper freeform; if keeper freeform is empty, take first loser's freeform lines.
  let freeformLines = extractFreeformLines(keeper.notes);
  if (freeformLines.length === 0) {
    for (const loser of orderedLosers) {
      const loserFreeform = extractFreeformLines(loser.notes);
      if (loserFreeform.length > 0) {
        freeformLines = loserFreeform;
        notesChanged = true;
        break;
      }
    }
  }

  for (const loser of orderedLosers) {
    const loserParts = extractStructuredParts(loser.notes, loser.taxId);

    if (!mergedParts.taxId && loserParts.taxId) {
      mergedParts.taxId = loserParts.taxId;
      filledFields.push("codiceFiscale");
      notesChanged = true;
    }

    if (!mergedParts.address && loserParts.address) {
      mergedParts.address = loserParts.address;
      filledFields.push("address");
      notesChanged = true;
    }

    if (!mergedParts.city && loserParts.city) {
      mergedParts.city = loserParts.city;
      if (!filledFields.includes("address")) {
        filledFields.push("address");
      }
      notesChanged = true;
    }

    if (mergedParts.conditions.length === 0 && loserParts.conditions.length > 0) {
      mergedParts.conditions = [...loserParts.conditions];
      filledFields.push("anamnesi");
      notesChanged = true;
    }

    if (!mergedParts.medications && loserParts.medications) {
      mergedParts.medications = loserParts.medications;
      filledFields.push("farmaci");
      notesChanged = true;
    }

    if (!mergedParts.extra && loserParts.extra) {
      mergedParts.extra = loserParts.extra;
      filledFields.push("extraNotes");
      notesChanged = true;
    }
  }

  if (notesChanged) {
    data.notes = rebuildNotes(freeformLines, mergedParts);
  }

  return { data, filledFields };
}
