import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";

const QUICKNOTES_CONTACT_LIMIT = 80;
const contactKinds = new Set(["doctor", "supplier"]);

export async function GET(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";
  const query = searchParams.get("q") ?? "";

  if (!contactKinds.has(kind)) {
    return NextResponse.json({ error: "Invalid contact kind" }, { status: 400 });
  }

  if (kind === "doctor") {
    const contacts = await searchDoctors(query);
    return NextResponse.json({ contacts });
  }

  const contacts = await searchSuppliers(query);
  return NextResponse.json({ contacts });
}

async function searchDoctors(query: string) {
  const tokens = getLookupTokens(query);
  const where: Prisma.DoctorWhereInput =
    tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { fullName: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { specialty: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { notes: { contains: token, mode: Prisma.QueryMode.insensitive } },
            ],
          })),
        }
      : {};

  const doctors = await prisma.doctor.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      specialty: true,
      phone: true,
    },
    orderBy: [{ fullName: "asc" }, { createdAt: "asc" }],
    take: QUICKNOTES_CONTACT_LIMIT,
  });

  return doctors.map((doctor) => ({
    id: doctor.id,
    displayName: doctor.fullName,
    detail: [doctor.specialty, doctor.phone].filter(Boolean).join(" · ") || doctor.id,
  }));
}

async function searchSuppliers(query: string) {
  const tokens = getLookupTokens(query);
  const where: Prisma.SupplierWhereInput =
    tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { name: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { notes: { contains: token, mode: Prisma.QueryMode.insensitive } },
            ],
          })),
        }
      : {};

  const suppliers = await prisma.supplier.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    take: QUICKNOTES_CONTACT_LIMIT,
  });

  return suppliers.map((supplier) => ({
    id: supplier.id,
    displayName: supplier.name,
    detail: [supplier.email, supplier.phone].filter(Boolean).join(" · ") || supplier.id,
  }));
}

function getLookupTokens(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return [...new Set(normalized.split(/\s+/).filter((token) => token.length >= 2))];
}
