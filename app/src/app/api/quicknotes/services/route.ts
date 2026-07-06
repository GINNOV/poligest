import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";

export async function GET(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      costBasis: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      costBasis: service.costBasis.toString(),
    })),
  });
}
