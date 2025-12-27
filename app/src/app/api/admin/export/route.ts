import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";

const tableQueries = {
  users: () => prisma.user.findMany(),
  doctors: () => prisma.doctor.findMany(),
  patients: () => prisma.patient.findMany(),
  consents: () => prisma.consent.findMany(),
  appointments: () => prisma.appointment.findMany(),
  clinicalNotes: () => prisma.clinicalNote.findMany(),
  smsTemplates: () => prisma.smsTemplate.findMany(),
  smsLogs: () => prisma.smsLog.findMany(),
  smsProviderConfig: () => prisma.smsProviderConfig.findMany(),
  auditLogs: () => prisma.auditLog.findMany(),
  suppliers: () => prisma.supplier.findMany(),
  products: () => prisma.product.findMany(),
  stockMovements: () => prisma.stockMovement.findMany(),
  financeEntries: () => prisma.financeEntry.findMany(),
  cashAdvances: () => prisma.cashAdvance.findMany(),
  recallRules: () => prisma.recallRule.findMany(),
  recalls: () => prisma.recall.findMany(),
} as const;

type TableKey = keyof typeof tableQueries;

export async function GET(req: Request) {
  const admin = await requireUser([Role.ADMIN]);

  const url = new URL(req.url);
  const requested = url.searchParams.getAll("tables") as TableKey[];
  const selected =
    requested.length > 0
      ? requested.filter((t) => t in tableQueries)
      : (Object.keys(tableQueries) as TableKey[]);

  if (selected.length === 0) {
    return errorResponse({
      message: "Nessuna tabella valida selezionata",
      status: 400,
      source: "admin_export",
      path: url.pathname,
      context: { requested },
      actor: admin,
    });
  }

  try {
    const data: Record<string, unknown> = {};
    for (const table of selected) {
      data[table] = await tableQueries[table]();
    }

    const body = {
      exportedAt: new Date().toISOString(),
      tables: selected,
      data,
    };

    const filename = `poligest-export-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    return NextResponse.json(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse({
      message: "Esportazione dati non riuscita",
      status: 500,
      source: "admin_export",
      path: url.pathname,
      context: { selected },
      error,
      actor: admin,
    });
  }
}
