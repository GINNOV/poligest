import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";

export async function GET(req: Request) {
  try {
    await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY, ASSISTANT_ROLE]);
    
    const { searchParams } = new URL(req.url);
    const firstName = searchParams.get("firstName")?.trim();
    const lastName = searchParams.get("lastName")?.trim();
    const phone = searchParams.get("phone")?.trim();

    if (!firstName && !lastName && !phone) {
      return NextResponse.json({ exists: false });
    }

    const conditions: any[] = [];
    if (firstName && lastName) {
      conditions.push({
        AND: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          { lastName: { equals: lastName, mode: "insensitive" } },
        ],
      });
    }
    if (phone) {
      conditions.push({ phone: { equals: phone } });
    }

    if (conditions.length === 0) {
      return NextResponse.json({ exists: false });
    }

    const existingPatient = await prisma.patient.findFirst({
      where: {
        OR: conditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (existingPatient) {
      return NextResponse.json({
        exists: true,
        patient: existingPatient,
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("[check-duplicate] error:", error);
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
