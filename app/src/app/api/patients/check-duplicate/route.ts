import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { parseOptionalBirthDate } from "@/lib/date";
import { findExistingPatientForCreate } from "@/lib/patients/find-existing-patient";

export async function GET(req: Request) {
  try {
    await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY, ASSISTANT_ROLE]);

    const { searchParams } = new URL(req.url);
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");
    const birthDateStr = searchParams.get("birthDate")?.trim() || null;
    const phone = searchParams.get("phone");
    const email = searchParams.get("email");
    const taxId = searchParams.get("taxId");

    if (!firstName || !lastName) {
      return NextResponse.json({ exists: false });
    }

    let birthDate: Date | null = null;
    if (birthDateStr) {
      try {
        birthDate = parseOptionalBirthDate(birthDateStr);
      } catch {
        birthDate = null;
      }
    }

    const match = await findExistingPatientForCreate({
      firstName,
      lastName,
      birthDate,
      phone,
      email,
      taxId,
    });

    if (match) {
      return NextResponse.json({
        exists: true,
        matchKind: match.matchKind,
        patient: {
          id: match.patientId,
          firstName: match.firstName ?? firstName,
          lastName: match.lastName ?? lastName,
          phone: match.phone ?? null,
          birthDate,
        },
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("[check-duplicate] error:", error);
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
