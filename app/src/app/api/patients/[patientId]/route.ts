import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit, logMacosScanAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  DELETE_CONFIRMATION_TEXT,
  isConfirmedDeleteRequest,
} from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";
import { deletePatientWithRelations } from "@/lib/patients/delete-patient";
import { mergeMissingPatientFieldsFromMacosScan } from "@/lib/patients/macos-patient-sync";

export async function PATCH(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patientId } = await params;
  if (!patientId) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const result = await mergeMissingPatientFieldsFromMacosScan(patientId, {
      birthDate: body.birthDate ?? null,
      gender: body.gender ?? null,
      codiceFiscale: body.codiceFiscale ?? null,
    });

    if (result.updatedFields.length > 0) {
      await logMacosScanAudit({
        action: "patient.updated",
        patientId: result.patientId,
        metadata: {
          updatedFields: result.updatedFields,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      action: "updated",
      patientId: result.patientId,
      updatedFields: result.updatedFields,
    });
  } catch (error) {
    console.error("API Error merging patient:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update patient";
    const status = errorMessage === "Patient not found" ? 404 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const user = await requireUser([Role.ADMIN]);

  if (!patientId) {
    return errorResponse({
      message: "Paziente non valido",
      status: 400,
      source: "patient_delete",
      actor: user,
    });
  }

  if (!isConfirmedDeleteRequest(req.headers, patientId, DELETE_CONFIRMATION_TEXT)) {
    return errorResponse({
      message: `Conferma eliminazione mancante. Digita '${DELETE_CONFIRMATION_TEXT}' per procedere.`,
      status: 400,
      source: "patient_delete",
      context: { patientId },
      actor: user,
    });
  }

  try {
    const existing = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!existing) {
      return errorResponse({
        message: "Paziente non trovato",
        status: 404,
        source: "patient_delete",
        context: { patientId },
        actor: user,
      });
    }

    await prisma.$transaction(async (tx) => {
      await deletePatientWithRelations(patientId, tx);
    });

    await logAudit(user, {
      action: "patient.deleted",
      entity: "Patient",
      entityId: patientId,
    });
    await logAudit(user, {
      action: "gdpr.erased",
      entity: "Patient",
      entityId: patientId,
    });

    // Ensure list is refreshed
    revalidatePath("/pazienti");
    revalidatePath("/pazienti/lista");
    revalidatePath("/pazienti/duplicati");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse({
      message: "Eliminazione non riuscita",
      status: 500,
      source: "patient_delete",
      context: { patientId },
      error,
      actor: user,
    });
  }
}
