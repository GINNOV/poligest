import { Gender, Prisma } from "@prisma/client";
import { isValidDate } from "@/lib/date";
import { normalizePersonName } from "@/lib/name";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { prisma } from "@/lib/prisma";

export type MacosPatientLookupInput = {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  codiceFiscale?: string | null;
};

export type MacosPatientLookupMatch = {
  patientId: string;
  matchKind: "taxId" | "nameBirthDate";
};

export type MacosPatientMergeInput = {
  birthDate?: string | null;
  gender?: string | null;
  codiceFiscale?: string | null;
};

export type MacosPatientRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: Gender;
  notes: string | null;
};

const SCANNER_NOTE = "Acquisito automaticamente da ID Scanner macOS";

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it");
}

export function parseItalianSlashBirthDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.includes("/")) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;

  const day = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10) - 1;
  const year = Number.parseInt(parts[2], 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;

  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapScannedGender(value: string | null | undefined): Gender | null {
  if (value === "M") return Gender.MALE;
  if (value === "F") return Gender.FEMALE;
  return null;
}

function taxIdNotesMarker(taxId: string) {
  return `Codice Fiscale: ${taxId}`;
}

export async function findPatientForMacosScan(
  input: MacosPatientLookupInput,
): Promise<MacosPatientLookupMatch | null> {
  const firstName = normalizePersonName(input.firstName);
  const lastName = normalizePersonName(input.lastName);
  const taxId = normalizeTaxId(input.codiceFiscale);
  const birthDate = parseItalianSlashBirthDate(input.birthDate);

  if (taxId) {
    const byTaxId = await prisma.patient.findFirst({
      where: {
        notes: {
          contains: taxIdNotesMarker(taxId),
          mode: "insensitive",
        },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (byTaxId) {
      return { patientId: byTaxId.id, matchKind: "taxId" };
    }
  }

  if (firstName && lastName && birthDate) {
    const byNameBirthDate = await prisma.patient.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        birthDate: { equals: birthDate },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (byNameBirthDate) {
      return { patientId: byNameBirthDate.id, matchKind: "nameBirthDate" };
    }
  }

  return null;
}

function buildMergedNotes(existingNotes: string | null | undefined, codiceFiscale: string | null) {
  const parsed = parsePatientStructuredNotes(existingNotes);
  const existingLines = (existingNotes ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const preservedLines = existingLines.filter(
    (line) =>
      !line.startsWith("Indirizzo:") &&
      !line.startsWith("Codice Fiscale:") &&
      !line.startsWith("Anamnesi:") &&
      !line.startsWith("Farmaci:") &&
      !line.startsWith("Note aggiuntive:") &&
      !line.startsWith("Note:"),
  );

  const nextTaxId = parsed.parsedTaxId || codiceFiscale || "";
  const structuredLines = [
    existingLines.find((line) => line.startsWith("Indirizzo:")) ??
      (parsed.parsedAddress || parsed.parsedCity
        ? `Indirizzo: ${parsed.parsedAddress || "—"}${parsed.parsedCity ? `, ${parsed.parsedCity}` : ""}`
        : null),
    nextTaxId ? taxIdNotesMarker(nextTaxId) : null,
    existingLines.find((line) => line.startsWith("Anamnesi:")) ??
      (parsed.parsedConditions.length ? `Anamnesi: ${parsed.parsedConditions.join(", ")}` : null),
    existingLines.find((line) => line.startsWith("Farmaci:")) ??
      (parsed.parsedMedications ? `Farmaci: ${parsed.parsedMedications}` : null),
    existingLines.find((line) => line.startsWith("Note aggiuntive:") || line.startsWith("Note:")) ??
      (parsed.parsedExtra ? `Note aggiuntive: ${parsed.parsedExtra}` : null),
  ].filter(Boolean) as string[];

  const provenanceLines = preservedLines.includes(SCANNER_NOTE) ? preservedLines : [...preservedLines, SCANNER_NOTE];

  return [...provenanceLines, ...structuredLines].join("\n") || null;
}

export function buildMacosPatientMergeUpdate(
  existing: MacosPatientRecord,
  scanned: MacosPatientMergeInput,
): { data: Prisma.PatientUpdateInput; updatedFields: string[] } {
  const updatedFields: string[] = [];
  const data: Prisma.PatientUpdateInput = {};

  const scannedBirthDate = parseItalianSlashBirthDate(scanned.birthDate);
  if (!isValidDate(existing.birthDate) && scannedBirthDate) {
    data.birthDate = scannedBirthDate;
    updatedFields.push("birthDate");
  }

  const scannedGender = mapScannedGender(scanned.gender);
  if (existing.gender === Gender.NOT_SPECIFIED && scannedGender) {
    data.gender = scannedGender;
    updatedFields.push("gender");
  }

  const existingParsed = parsePatientStructuredNotes(existing.notes);
  const scannedTaxId = normalizeTaxId(scanned.codiceFiscale);
  const shouldUpdateNotes = Boolean(scannedTaxId && !existingParsed.parsedTaxId);
  if (shouldUpdateNotes) {
    data.notes = buildMergedNotes(existing.notes, scannedTaxId);
    updatedFields.push("codiceFiscale");
  }

  return { data, updatedFields };
}

export async function mergeMissingPatientFieldsFromMacosScan(
  patientId: string,
  scanned: MacosPatientMergeInput,
): Promise<{ patientId: string; updatedFields: string[] }> {
  const existing = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      gender: true,
      notes: true,
    },
  });

  if (!existing) {
    throw new Error("Patient not found");
  }

  const { data, updatedFields } = buildMacosPatientMergeUpdate(existing, scanned);
  if (updatedFields.length > 0) {
    await prisma.patient.update({
      where: { id: patientId },
      data,
    });
  }

  return { patientId, updatedFields };
}