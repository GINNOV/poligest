import { NextResponse } from "next/server";
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