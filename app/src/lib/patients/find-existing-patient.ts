import { isValidDate } from "@/lib/date";
import { normalizePersonName } from "@/lib/name";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { normalizeItalianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type ExistingPatientMatchInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  taxId?: string | null;
};

export type ExistingPatientMatchKind = "taxId" | "email" | "phone" | "nameBirthDate";

export type ExistingPatientMatch = {
  patientId: string;
  matchKind: ExistingPatientMatchKind;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it");
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("it");
}

function toUtcDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when two Date values represent the same civil day despite UTC vs local storage. */
export function sameCalendarDate(left: Date, right: Date) {
  if (!isValidDate(left) || !isValidDate(right)) return false;
  const leftKeys = new Set([toUtcDateKey(left), toLocalDateKey(left)]);
  return leftKeys.has(toUtcDateKey(right)) || leftKeys.has(toLocalDateKey(right));
}

function extractTaxIdFromNotes(notes: string | null | undefined) {
  const parsed = normalizeTaxId(parsePatientStructuredNotes(notes).parsedTaxId);
  if (parsed) return parsed;
  const match = (notes ?? "").match(/Codice Fiscale:\s*([A-Z0-9]{16})/i);
  return normalizeTaxId(match?.[1] ?? "");
}

/**
 * Shared identity check used before creating a patient from any channel
 * (web form, ScanID token API, appointments).
 *
 * Match priority:
 * 1. codice fiscale (notes) — strong unique id, name not required
 * 2. same normalized name + email
 * 3. same normalized name + phone
 * 4. same normalized name + birth date
 */
export async function findExistingPatientForCreate(
  input: ExistingPatientMatchInput,
): Promise<ExistingPatientMatch | null> {
  const firstName = normalizePersonName(input.firstName ?? "");
  const lastName = normalizePersonName(input.lastName ?? "");
  const taxId = normalizeTaxId(input.taxId);
  const email = normalizeEmail(input.email);
  const phone = normalizeItalianPhone(input.phone);
  const birthDate = isValidDate(input.birthDate) ? input.birthDate : null;

  if (taxId) {
    // Prefer first-class column (unique when set).
    const byColumn = await prisma.patient.findFirst({
      where: { taxId: { equals: taxId, mode: "insensitive" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (byColumn) {
      return {
        patientId: byColumn.id,
        matchKind: "taxId",
        firstName: byColumn.firstName,
        lastName: byColumn.lastName,
        phone: byColumn.phone,
      };
    }

    // Fallback: CF still only in notes for unmigrated rows.
    const candidates = await prisma.patient.findMany({
      where: {
        notes: {
          contains: taxId,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        notes: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const byTaxId = candidates.find((candidate) => extractTaxIdFromNotes(candidate.notes) === taxId);
    if (byTaxId) {
      return {
        patientId: byTaxId.id,
        matchKind: "taxId",
        firstName: byTaxId.firstName,
        lastName: byTaxId.lastName,
        phone: byTaxId.phone,
      };
    }
  }

  if (!firstName || !lastName) {
    return null;
  }

  if (!email && !phone && !birthDate) {
    return null;
  }

  const candidates = await prisma.patient.findMany({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  if (email) {
    const byEmail = candidates.find((candidate) => normalizeEmail(candidate.email) === email);
    if (byEmail) {
      return {
        patientId: byEmail.id,
        matchKind: "email",
        firstName: byEmail.firstName,
        lastName: byEmail.lastName,
        phone: byEmail.phone,
      };
    }
  }

  if (phone) {
    const byPhone = candidates.find((candidate) => normalizeItalianPhone(candidate.phone) === phone);
    if (byPhone) {
      return {
        patientId: byPhone.id,
        matchKind: "phone",
        firstName: byPhone.firstName,
        lastName: byPhone.lastName,
        phone: byPhone.phone,
      };
    }
  }

  if (birthDate) {
    const byBirthDate = candidates.find(
      (candidate) => isValidDate(candidate.birthDate) && sameCalendarDate(birthDate, candidate.birthDate),
    );
    if (byBirthDate) {
      return {
        patientId: byBirthDate.id,
        matchKind: "nameBirthDate",
        firstName: byBirthDate.firstName,
        lastName: byBirthDate.lastName,
        phone: byBirthDate.phone,
      };
    }
  }

  return null;
}

export function formatExistingPatientBlockMessage(match: ExistingPatientMatch) {
  const name = [match.lastName, match.firstName].filter(Boolean).join(" ").trim();
  const label = name || match.patientId;
  const kindLabel =
    match.matchKind === "taxId"
      ? "codice fiscale"
      : match.matchKind === "email"
        ? "email"
        : match.matchKind === "phone"
          ? "telefono"
          : "nome e data di nascita";

  return `Esiste già un paziente con lo stesso ${kindLabel}: ${label}. Apri la scheda esistente invece di crearne una nuova.`;
}
