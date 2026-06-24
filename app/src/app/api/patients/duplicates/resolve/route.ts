import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { DELETE_CONFIRMATION_TEXT, hasTypedConfirmation } from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";
import { deletePatientWithRelations } from "@/lib/patients/delete-patient";

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN]);

  try {
    const body = await req.json().catch(() => null);
    const keepPatientId = typeof body?.keepPatientId === "string" ? body.keepPatientId.trim() : "";
    const duplicatePatientIds: string[] = Array.isArray(body?.duplicatePatientIds)
      ? body.duplicatePatientIds
          .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      : [];
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";

    if (!keepPatientId || duplicatePatientIds.length === 0) {
      return errorResponse({
        message: "Dati duplicati non validi",
        status: 400,
        source: "patient_duplicate_resolve",
        actor: user,
      });
    }

    if (duplicatePatientIds.includes(keepPatientId)) {
      return errorResponse({
        message: "La scheda da mantenere non puo essere inclusa tra quelle da eliminare",
        status: 400,
        source: "patient_duplicate_resolve",
        context: { keepPatientId, duplicatePatientIds },
        actor: user,
      });
    }

    if (!hasTypedConfirmation(confirmation, DELETE_CONFIRMATION_TEXT)) {
      return errorResponse({
        message: `Conferma eliminazione mancante. Digita '${DELETE_CONFIRMATION_TEXT}' per procedere.`,
        status: 400,
        source: "patient_duplicate_resolve",
        context: { keepPatientId, duplicatePatientIds },
        actor: user,
      });
    }

    const uniqueDeleteIds: string[] = Array.from(new Set(duplicatePatientIds));

    const patients = await prisma.patient.findMany({
      where: { id: { in: [keepPatientId, ...uniqueDeleteIds] } },
      select: { id: true, firstName: true, lastName: true },
    });

    const keepPatient = patients.find((patient) => patient.id === keepPatientId);
    if (!keepPatient) {
      return errorResponse({
        message: "Scheda da mantenere non trovata",
        status: 404,
        source: "patient_duplicate_resolve",
        context: { keepPatientId },
        actor: user,
      });
    }

    if (patients.length !== uniqueDeleteIds.length + 1) {
      return errorResponse({
        message: "Una o piu schede duplicate non sono state trovate",
        status: 404,
        source: "patient_duplicate_resolve",
        context: { keepPatientId, duplicatePatientIds: uniqueDeleteIds },
        actor: user,
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const patientId of uniqueDeleteIds) {
        await deletePatientWithRelations(patientId, tx);
      }
    });

    await logAudit(user, {
      action: "patient.duplicates_resolved",
      entity: "Patient",
      entityId: keepPatientId,
      metadata: {
        keptPatientId: keepPatientId,
        deletedPatientIds: uniqueDeleteIds,
      },
    });

    await Promise.all(
      uniqueDeleteIds.flatMap((patientId) => [
        logAudit(user, {
          action: "patient.deleted",
          entity: "Patient",
          entityId: patientId,
          metadata: { keptPatientId: keepPatientId, reason: "duplicate_resolution" },
        }),
        logAudit(user, {
          action: "gdpr.erased",
          entity: "Patient",
          entityId: patientId,
          metadata: { keptPatientId: keepPatientId, reason: "duplicate_resolution" },
        }),
      ]),
    );

    revalidatePath("/pazienti");
    revalidatePath("/pazienti/duplicati");
    revalidatePath(`/pazienti/${keepPatientId}`);

    return NextResponse.json({
      ok: true,
      keptPatientId: keepPatientId,
      deletedPatientIds: uniqueDeleteIds,
    });
  } catch (error) {
    return errorResponse({
      message: "Risoluzione duplicati non riuscita",
      status: 500,
      source: "patient_duplicate_resolve",
      error,
      actor: user,
    });
  }
}
