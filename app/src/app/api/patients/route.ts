import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Authentication check: Accept Authorization header or x-api-key
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("x-api-key");
  
  // Default to a fallback secret for development ease
  const expectedToken = process.env.MACOS_APP_API_KEY || "poligest_macos_secret";
  
  if (authHeader !== `Bearer ${expectedToken}` && apiKey !== expectedToken) {
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
    let mappedGender = "NOT_SPECIFIED";
    if (gender === "M") {
      mappedGender = "MALE";
    } else if (gender === "F") {
      mappedGender = "FEMALE";
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        birthDate: parsedBirthDate,
        gender: mappedGender as any,
        notes: notes || null,
      },
    });

    return NextResponse.json({ ok: true, patientId: patient.id });
  } catch (error: any) {
    console.error("API Error creating patient:", error);
    return NextResponse.json({ error: error.message || "Failed to create patient" }, { status: 500 });
  }
}
