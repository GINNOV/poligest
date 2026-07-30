import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender } from "@prisma/client";
import { logMacosScanAudit } from "@/lib/audit";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";
import { findExistingPatientForCreate } from "@/lib/patients/find-existing-patient";
import {
  mergeMissingPatientFieldsFromMacosScan,
  parseItalianSlashBirthDate,
} from "@/lib/patients/macos-patient-sync";
import { withPaperConsentNote } from "@/lib/patients/paper-consent";
import { resolveStoredPatientPhotoUrl } from "@/lib/patient-avatars";
import { normalizePersonName } from "@/lib/name";
import { normalizeItalianPhone } from "@/lib/phone";

export async function POST(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const firstName = normalizePersonName(body.firstName ?? "");
    const lastName = normalizePersonName(body.lastName ?? "");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const phone = normalizeItalianPhone(body.phone);
    const notes = typeof body.notes === "string" ? body.notes : null;
    const gender = body.gender;
    const hasPaperConsentForRequired = body.hasPaperConsentForRequired ?? true;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    // Prefer explicit codiceFiscale field; fall back to structured notes from ScanID.
    const taxIdFromBody =
      typeof body.codiceFiscale === "string" ? body.codiceFiscale.trim().toUpperCase() : "";
    const taxIdMatch = notes?.match(/Codice Fiscale:\s*([A-Z0-9]{16})/i);
    const taxId = taxIdFromBody || taxIdMatch?.[1]?.toUpperCase() || null;

    const parsedBirthDate = parseItalianSlashBirthDate(body.birthDate ?? null);

    // Map gender string to Gender enum
    let mappedGender: Gender = Gender.NOT_SPECIFIED;
    if (gender === "M") {
      mappedGender = Gender.MALE;
    } else if (gender === "F") {
      mappedGender = Gender.FEMALE;
    }

    // Server-side re-check so skipped/stale client lookup cannot create a second row.
    // Token apps (ScanID) only require patientId + 2xx — action may be "created" or "updated".
    const existing = await findExistingPatientForCreate({
      firstName,
      lastName,
      email,
      phone,
      birthDate: parsedBirthDate,
      taxId,
    });

    if (existing) {
      const mergeResult = await mergeMissingPatientFieldsFromMacosScan(existing.patientId, {
        birthDate: body.birthDate ?? null,
        gender: body.gender ?? null,
        codiceFiscale: taxId,
        email,
        phone,
      });

      if (mergeResult.updatedFields.length > 0) {
        await logMacosScanAudit({
          action: "patient.updated",
          patientId: mergeResult.patientId,
          metadata: {
            patientName: `${lastName} ${firstName}`,
            matchKind: existing.matchKind,
            updatedFields: mergeResult.updatedFields,
            source: "create_dedup",
          },
        });
      }

      return NextResponse.json({
        ok: true,
        action: "updated",
        patientId: mergeResult.patientId,
        matchKind: existing.matchKind,
        updatedFields: mergeResult.updatedFields,
      });
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        birthDate: parsedBirthDate,
        gender: mappedGender,
        notes: withPaperConsentNote(notes, hasPaperConsentForRequired),
        hasPaperConsentForRequired,
      },
    });

    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        photoUrl: resolveStoredPatientPhotoUrl({
          patientId: patient.id,
          firstName,
          gender: mappedGender,
          taxId,
        }),
      },
    });

    await logMacosScanAudit({
      action: "patient.created",
      patientId: patient.id,
      metadata: {
        patientName: `${lastName} ${firstName}`,
      },
    });

    return NextResponse.json({ ok: true, action: "created", patientId: patient.id });
  } catch (error) {
    console.error("API Error creating patient:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create patient";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
