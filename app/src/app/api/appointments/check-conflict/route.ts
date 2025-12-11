import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

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

  const conflicts = await prisma.appointment.count({
    where: {
      doctorId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endDate },
      endsAt: { gt: startDate },
    },
  });

  return NextResponse.json({ conflict: conflicts > 0, count: conflicts });
}
