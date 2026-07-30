import { isValidDate } from "@/lib/date";
import type { FullPatientAttachmentCounts } from "@/lib/patients/duplicate-attachments";
import { isPatientEmptyShell } from "@/lib/patients/duplicate-attachments";
import type { DuplicatePatientRecord } from "@/lib/patients/duplicate-detection";

export type DuplicateFieldConflict = {
  field: "email" | "phone" | "birthDate" | "taxId";
  label: string;
  values: Array<{ patientId: string; display: string }>;
};

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("it");
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it");
}

function birthDateKey(value: Date | null | undefined) {
  if (!isValidDate(value)) return "";
  return value.toISOString().slice(0, 10);
}

function formatBirthDateDisplay(value: Date | null) {
  if (!isValidDate(value)) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/**
 * Fields where patients in a group disagree (after basic normalization).
 * Used to warn staff before destructive actions.
 */
export function getDuplicateFieldConflicts(
  patients: Array<
    Pick<DuplicatePatientRecord, "id" | "email" | "phone" | "birthDate" | "taxId">
  >,
): DuplicateFieldConflict[] {
  if (patients.length < 2) return [];

  const conflicts: DuplicateFieldConflict[] = [];

  const emailKeys = new Set(
    patients.map((p) => normalizeEmail(p.email)).filter(Boolean),
  );
  if (emailKeys.size > 1) {
    conflicts.push({
      field: "email",
      label: "Email",
      values: patients.map((p) => ({
        patientId: p.id,
        display: p.email?.trim() || "—",
      })),
    });
  }

  const phoneKeys = new Set(
    patients.map((p) => normalizePhone(p.phone)).filter(Boolean),
  );
  if (phoneKeys.size > 1) {
    conflicts.push({
      field: "phone",
      label: "Telefono",
      values: patients.map((p) => ({
        patientId: p.id,
        display: p.phone?.trim() || "—",
      })),
    });
  }

  const birthKeys = new Set(
    patients.map((p) => birthDateKey(p.birthDate)).filter(Boolean),
  );
  if (birthKeys.size > 1) {
    conflicts.push({
      field: "birthDate",
      label: "Data di nascita",
      values: patients.map((p) => ({
        patientId: p.id,
        display: formatBirthDateDisplay(p.birthDate),
      })),
    });
  }

  const taxKeys = new Set(
    patients.map((p) => normalizeTaxId(p.taxId)).filter(Boolean),
  );
  if (taxKeys.size > 1) {
    conflicts.push({
      field: "taxId",
      label: "Codice fiscale",
      values: patients.map((p) => ({
        patientId: p.id,
        display: p.taxId?.trim() || "—",
      })),
    });
  }

  return conflicts;
}

export function countNonEmptyPatients(
  patientIds: string[],
  countsByPatientId: Map<string, FullPatientAttachmentCounts>,
): number {
  return patientIds.filter((id) => {
    const counts = countsByPatientId.get(id);
    if (!counts) return true; // fail closed: unknown = treat as non-empty
    return !isPatientEmptyShell(counts);
  }).length;
}

export type ReviewGroupKind = "safe" | "multi_data" | "identity_conflict" | "review";

export function getReviewGroupKind(input: {
  safe: boolean;
  nonEmptyCount: number;
  conflicts: DuplicateFieldConflict[];
}): ReviewGroupKind {
  if (input.safe) return "safe";
  if (input.nonEmptyCount >= 2) return "multi_data";
  if (input.conflicts.some((c) => c.field === "taxId" || c.field === "birthDate")) {
    return "identity_conflict";
  }
  return "review";
}

export function getReviewGroupBadge(kind: ReviewGroupKind): {
  label: string;
  className: string;
} {
  switch (kind) {
    case "safe":
      return {
        label: "Unione sicura",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
      };
    case "multi_data":
      return {
        label: "Da rivedere — entrambe con dati",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
      };
    case "identity_conflict":
      return {
        label: "Da rivedere — conflitti identità",
        className:
          "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200",
      };
    case "review":
      return {
        label: "Da rivedere",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
      };
  }
}

/** Hard-delete of another card is only OK when every non-keeper is an empty shell. */
export function canHardDeleteOthers(
  otherPatientIds: string[],
  countsByPatientId: Map<string, FullPatientAttachmentCounts>,
): boolean {
  if (otherPatientIds.length === 0) return false;
  return otherPatientIds.every((id) => {
    const counts = countsByPatientId.get(id);
    return counts ? isPatientEmptyShell(counts) : false;
  });
}
