import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";
import { findPatientForMacosScan } from "@/lib/patients/macos-patient-sync";
import { normalizePersonName } from "@/lib/name";

export async function POST(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const firstName = normalizePersonName(body.firstName);
    const lastName = normalizePersonName(body.lastName);

    if (!firstName || !lastName) {
      return NextResponse.json({ exists: false });
    }

    const match = await findPatientForMacosScan({
      firstName,
      lastName,
      birthDate: body.birthDate ?? null,
      codiceFiscale: body.codiceFiscale ?? null,
    });

    if (!match) {
      const exactCandidates = await findPatientCandidatesByExactName(firstName, lastName);
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

      const similarCandidates = await findSimilarPatientCandidates(firstName, lastName);
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

async function findPatientCandidatesByExactName(firstName: string, lastName: string): Promise<PatientLookupCandidate[]> {
  return prisma.patient.findMany({
    where: {
      OR: [
        {
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
        },
        {
          firstName: { equals: lastName, mode: "insensitive" },
          lastName: { equals: firstName, mode: "insensitive" },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      phone: true,
      email: true,
    },
    orderBy: { createdAt: "asc" },
    take: 6,
  });
}

async function findSimilarPatientCandidates(firstName: string, lastName: string): Promise<PatientLookupCandidate[]> {
  const tokens = [...new Set(`${firstName} ${lastName}`.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2))];
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
    take: 6,
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
