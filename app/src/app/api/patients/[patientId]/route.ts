import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  DELETE_CONFIRMATION_TEXT,
  isConfirmedDeleteRequest,
} from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";

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

    await prisma.patient.delete({ where: { id: patientId } });

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
