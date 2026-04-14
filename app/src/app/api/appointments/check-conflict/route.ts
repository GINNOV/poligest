import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";
import { ASSISTANT_ROLE } from "@/lib/roles";

export async function GET(req: Request) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const startsAt = searchParams.get("startsAt");
    const endsAt = searchParams.get("endsAt");
    const excludeId = searchParams.get("excludeId") ?? undefined;

    if (!doctorId || !startsAt || !endsAt) {
      return NextResponse.json({ conflict: false, message: "Dati insufficienti" });
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ conflict: false, message: "Formato data non valido" });
    }

    // Allow concurrent appointments for the same doctor
    return NextResponse.json({ conflict: false, count: 0 });
  } catch (error) {
    return errorResponse({
      message: "Errore controllo conflitti",
      status: 500,
      source: "appointment_conflict_check",
      path: new URL(req.url).pathname,
      error,
    });
  }
}