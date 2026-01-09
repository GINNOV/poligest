import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { errorResponse } from "@/lib/error-response";

export async function DELETE(_: Request, { params }: { params: Promise<{ patientId: string }> }) {
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

  try {
    await prisma.$transaction([
      prisma.dentalRecord.deleteMany({ where: { patientId } }),
      prisma.clinicalNote.deleteMany({ where: { patientId } }),
      prisma.recall.deleteMany({ where: { patientId } }),
      prisma.recurringMessageLog.deleteMany({ where: { patientId } }),
      prisma.appointment.deleteMany({ where: { patientId } }),
      prisma.stockMovement.deleteMany({ where: { patientId } }),
      prisma.patientConsent.deleteMany({ where: { patientId } }),
      prisma.smsLog.deleteMany({ where: { patientId } }),
      prisma.cashAdvance.deleteMany({ where: { patientId } }),
      prisma.patient.delete({ where: { id: patientId } }),
    ]);

    await logAudit(user, {
      action: "patient.deleted",
      entity: "Patient",
      entityId: patientId,
    });

    // Ensure list is refreshed
    revalidatePath("/pazienti");

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
