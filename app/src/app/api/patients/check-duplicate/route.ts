import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { normalizePersonName } from "@/lib/name";
import { normalizeItalianPhone } from "@/lib/phone";

export async function GET(req: Request) {
  try {
    await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY, ASSISTANT_ROLE]);
    
    const { searchParams } = new URL(req.url);
    const firstName = normalizePersonName(searchParams.get("firstName"));
    const lastName = normalizePersonName(searchParams.get("lastName"));
    const birthDateStr = searchParams.get("birthDate")?.trim();
    const phone = normalizeItalianPhone(searchParams.get("phone"));
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!firstName || !lastName) {
      return NextResponse.json({ exists: false });
    }

    const matchSignals: Prisma.PatientWhereInput[] = [];
    if (birthDateStr) {
      const birthDate = new Date(birthDateStr);
      if (!isNaN(birthDate.getTime())) {
        matchSignals.push({ birthDate: { equals: birthDate } });
      }
    }
    if (phone) {
      matchSignals.push({ phone: { equals: phone } });
    }
    if (email) {
      matchSignals.push({ email: { equals: email, mode: "insensitive" as const } });
    }

    if (matchSignals.length === 0) {
      return NextResponse.json({ exists: false });
    }

    // Match the same normalized name plus any strong identifying field provided by the form.
    const existingPatient = await prisma.patient.findFirst({
      where: {
        AND: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          { lastName: { equals: lastName, mode: "insensitive" } },
          { OR: matchSignals },
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
