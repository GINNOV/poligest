import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { buildStockMovementFilters } from "@/app/[locale]/(app)/magazzino/stock-movement-filters";

export async function GET(request: Request) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const params = new URL(request.url).searchParams;
  const { where } = buildStockMovementFilters({
    mq: params.get("mq"),
    from: params.get("from"),
    to: params.get("to"),
  });

  const movements = await prisma.stockMovement.findMany({
    where: {
      AND: [
        { patientId: { not: null } },
        ...(where ? [where] : []),
      ],
    },
    include: {
      product: { include: { supplier: true } },
      patient: true,
    },
    orderBy: { interventionDate: 'desc' },
  });

  const header = [
    "NOME E COGNOME PAZIENTE",
    "TIPO DI DM",
    "MARCA",
    "DATA ACQUISTO",
    "CODICE UDI-DI",
    "CODICE UDI-PI",
    "DATA INTERVENTO",
    "SEDE INTERVENTO"
  ].join(";");

  const rows = movements.map(m => {
    const patientName = m.patient ? `${m.patient.lastName} ${m.patient.firstName}` : "";
    const deviceType = m.product.serviceType || "Impianto";
    const brand = m.product.brand || m.product.supplier?.name || "";
    const pDate = m.purchaseDate ? format(m.purchaseDate, "dd/MM/yyyy") : "";
    const udiDi = m.product.udiDi || "";
    const udiPi = m.udiPi || "";
    const intDate = m.interventionDate ? format(m.interventionDate, "dd/MM/yyyy") : "";
    const site = m.interventionSite || "";

    // Escape quotes
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

    return [
      escape(patientName),
      escape(deviceType),
      escape(brand),
      escape(pDate),
      escape(udiDi),
      escape(udiPi),
      escape(intDate),
      escape(site)
    ].join(";");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="magazzino_export_${format(new Date(), "yyyyMMdd")}.csv"`,
    },
  });
}