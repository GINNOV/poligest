import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";
import { buildPatientExport } from "@/lib/gdpr";
import { logAudit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const { patientId } = await params;

  if (!patientId) {
    return errorResponse({
      message: "Paziente non valido",
      status: 400,
      source: "patient_export",
      actor: user,
    });
  }

  try {
    const exportPayload = await buildPatientExport(patientId);

    if (!exportPayload.patient) {
      return errorResponse({
        message: "Paziente non trovato",
        status: 404,
        source: "patient_export",
        actor: user,
        context: { patientId },
      });
    }

    await logAudit(user, {
      action: "gdpr.exported",
      entity: "Patient",
      entityId: patientId,
      metadata: { scope: "patient" },
    });

    const filename = `poligest-patient-export-${patientId}-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        patientId,
        data: exportPayload,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      },
    );
  } catch (error) {
    return errorResponse({
      message: "Esportazione paziente non riuscita",
      status: 500,
      source: "patient_export",
      actor: user,
      context: { patientId },
      error,
    });
  }
}
