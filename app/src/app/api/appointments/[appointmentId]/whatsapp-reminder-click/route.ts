import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/error-response";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

  if (!appointmentId) {
    return errorResponse({
      message: "Appuntamento non valido",
      status: 400,
      source: "appointment_whatsapp_reminder_click",
      actor: user,
    });
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, patientId: true },
    });

    if (!appointment) {
      return errorResponse({
        message: "Appuntamento non trovato",
        status: 404,
        source: "appointment_whatsapp_reminder_click",
        context: { appointmentId },
        actor: user,
      });
    }

    await logAudit(user, {
      action: "appointment.whatsapp_reminder_clicked",
      entity: "Appointment",
      entityId: appointmentId,
      metadata: { patientId: appointment.patientId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse({
      message: "Registrazione promemoria non riuscita",
      status: 500,
      source: "appointment_whatsapp_reminder_click",
      context: { appointmentId },
      error,
      actor: user,
    });
  }
}
