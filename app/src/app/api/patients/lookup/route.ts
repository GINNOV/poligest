import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";
import { findPatientForMacosScan } from "@/lib/patients/macos-patient-sync";
import { normalizePersonName } from "@/lib/name";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";

const QUICKNOTES_PATIENT_LIST_LIMIT = 80;

export async function GET(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const tokens = getLookupTokens(query);

  const where: Prisma.PatientWhereInput =
    tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { firstName: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: token, mode: Prisma.QueryMode.insensitive } },
            ],
          })),
        }
      : {};

  const [patients, staffUsers] = await Promise.all([
    prisma.patient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        phone: true,
        email: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "asc" }],
      take: QUICKNOTES_PATIENT_LIST_LIMIT,
    }),
    prisma.user.findMany({
      select: { email: true },
      where: { role: { not: Role.PATIENT } },
    }),
  ]);

  const staffEmails = new Set(
    staffUsers
      .map((user) => user.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  const filteredPatients = staffEmails.size
    ? patients.filter((patient) => {
        if (!patient.email) return true;
        return !staffEmails.has(patient.email.trim().toLowerCase());
      })
    : patients;

  return NextResponse.json({
    patients: filteredPatients.map(formatDirectoryPatient),
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const firstName = normalizePersonName(body.firstName);
    const lastName = normalizePersonName(body.lastName);
    const fullName = normalizePersonName(body.fullName ?? [firstName, lastName].filter(Boolean).join(" "));

    if (!firstName || !lastName) {
      return NextResponse.json({ exists: false });
    }

    const match = await findPatientForMacosScan({
      firstName,
      lastName,
      birthDate: body.birthDate ?? null,
      codiceFiscale: body.codiceFiscale ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
    });

    if (!match) {
      const exactCandidates = await findPatientCandidatesByExactName(fullName || `${firstName} ${lastName}`);
      if (exactCandidates.length === 1) {
        const [candidate] = exactCandidates;
        return NextResponse.json({
          exists: true,
          patientId: candidate.id,
          matchKind: "name",
          candidates: [formatPatientCandidate(candidate)],
        });
      }

      if (exactCandidates.length > 1) {
        return NextResponse.json({
          exists: false,
          matchKind: "ambiguous",
          candidates: exactCandidates.map(formatPatientCandidate),
        });
      }

      const similarCandidates = await findSimilarPatientCandidates(fullName || `${firstName} ${lastName}`);
      if (similarCandidates.length > 0) {
        return NextResponse.json({
          exists: false,
          matchKind: "similar",
          candidates: similarCandidates.map(formatPatientCandidate),
        });
      }

      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      patientId: match.patientId,
      matchKind: match.matchKind,
    });
  } catch (error) {
    console.error("API Error looking up patient:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to look up patient";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

type PatientLookupCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
};

type PatientDirectoryCandidate = PatientLookupCandidate & {
  notes: string | null;
  createdAt: Date;
};

async function findPatientCandidatesByExactName(fullName: string): Promise<PatientLookupCandidate[]> {
  const queryKey = normalizeLookupText(fullName);
  const candidates = await findCandidatePool(fullName, { take: 20 });

  return candidates
    .filter((candidate) => getPatientNameKeys(candidate).includes(queryKey))
    .slice(0, 6);
}

async function findSimilarPatientCandidates(fullName: string): Promise<PatientLookupCandidate[]> {
  return findCandidatePool(fullName, { take: 6 });
}

async function findCandidatePool(fullName: string, { take }: { take: number }): Promise<PatientLookupCandidate[]> {
  const tokens = getLookupTokens(fullName);
  if (tokens.length === 0) {
    return [];
  }

  return prisma.patient.findMany({
    where: {
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      })),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      phone: true,
      email: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
  });
}

function formatPatientCandidate(candidate: PatientLookupCandidate) {
  const detailParts = [
    candidate.birthDate ? candidate.birthDate.toISOString().slice(0, 10) : null,
    candidate.phone,
    candidate.email,
  ].filter(Boolean);

  return {
    patientId: candidate.id,
    displayName: `${candidate.lastName} ${candidate.firstName}`.trim(),
    detail: detailParts.join(" · ") || candidate.id,
  };
}

function formatDirectoryPatient(candidate: PatientDirectoryCandidate) {
  const taxId = parsePatientStructuredNotes(candidate.notes).parsedTaxId || null;
  const detailParts = [
    candidate.birthDate ? candidate.birthDate.toISOString().slice(0, 10) : null,
    candidate.phone,
    candidate.email,
    taxId,
  ].filter(Boolean);

  return {
    patientId: candidate.id,
    displayName: `${candidate.lastName} ${candidate.firstName}`.trim(),
    detail: detailParts.join(" · ") || candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    birthDate: candidate.birthDate ? candidate.birthDate.toISOString().slice(0, 10) : null,
    phone: candidate.phone,
    email: candidate.email,
    taxId,
  };
}

function getPatientNameKeys(candidate: PatientLookupCandidate) {
  return [
    `${candidate.firstName} ${candidate.lastName}`,
    `${candidate.lastName} ${candidate.firstName}`,
  ]
    .map(normalizeLookupText)
    .filter(Boolean);
}

function getLookupTokens(value: string) {
  return [...new Set(normalizePersonName(value).split(/\s+/).filter((token) => token.length >= 2))];
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
