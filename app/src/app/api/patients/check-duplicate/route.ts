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
    const birthDateStr = searchParams.get("birthDate")?.trim();

    if (!firstName || !lastName || !birthDateStr) {
      return NextResponse.json({ exists: false });
    }

    const birthDate = new Date(birthDateStr);
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json({ exists: false });
    }

    // Match all three: firstName, lastName, and birthDate
    const existingPatient = await prisma.patient.findFirst({
      where: {
        AND: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          { lastName: { equals: lastName, mode: "insensitive" } },
          { birthDate: { equals: birthDate } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        birthDate: true,
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
