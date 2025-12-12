import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function DELETE(_: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const user = await requireUser([Role.ADMIN]);

  if (!patientId) {
    return NextResponse.json({ error: "Paziente non valido" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.dentalRecord.deleteMany({ where: { patientId } }),
      prisma.clinicalNote.deleteMany({ where: { patientId } }),
      prisma.recall.deleteMany({ where: { patientId } }),
      prisma.appointment.deleteMany({ where: { patientId } }),
      prisma.stockMovement.deleteMany({ where: { patientId } }),
      prisma.consent.deleteMany({ where: { patientId } }),
      prisma.smsLog.deleteMany({ where: { patientId } }),
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
  } catch (err) {
    return NextResponse.json({ error: "Eliminazione non riuscita" }, { status: 500 });
  }
}
