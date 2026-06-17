import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender } from "@prisma/client";
import { logMacosScanAudit } from "@/lib/audit";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";

export async function POST(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, birthDate, gender, notes } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    // Convert birthDate string to Date object
    let parsedBirthDate: Date | null = null;
    if (birthDate) {
      // Expecting birthDate in DD/MM/YYYY format or ISO format
      if (birthDate.includes("/")) {
        const parts = birthDate.split("/");
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // 0-indexed month
          const year = parseInt(parts[2], 10);
          parsedBirthDate = new Date(year, month, day);
        }
      } else {
        parsedBirthDate = new Date(birthDate);
      }
      
      // Check if invalid date
      if (parsedBirthDate && isNaN(parsedBirthDate.getTime())) {
        parsedBirthDate = null;
      }
    }

    // Map gender string to Gender enum
    let mappedGender: Gender = Gender.NOT_SPECIFIED;
    if (gender === "M") {
      mappedGender = Gender.MALE;
    } else if (gender === "F") {
      mappedGender = Gender.FEMALE;
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        birthDate: parsedBirthDate,
        gender: mappedGender,
        notes: notes || null,
      },
    });

    await logMacosScanAudit({
      action: "patient.created",
      patientId: patient.id,
      metadata: {
        patientName: `${lastName} ${firstName}`,
      },
    });

    return NextResponse.json({ ok: true, action: "created", patientId: patient.id });
  } catch (error) {
    console.error("API Error creating patient:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create patient";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
