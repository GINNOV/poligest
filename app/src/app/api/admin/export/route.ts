import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { JsonObject } from "@/lib/json-types";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";

const tableQueries = {
  users: () => prisma.user.findMany(),
  doctors: () => prisma.doctor.findMany(),
  doctorAvailabilityWindows: () => prisma.doctorAvailabilityWindow.findMany(),
  patients: () => prisma.patient.findMany(),
  consentModules: () => prisma.consentModule.findMany(),
  patientConsents: () => prisma.patientConsent.findMany(),
  appointments: () => prisma.appointment.findMany(),
  appointmentReminderRules: () => prisma.appointmentReminderRule.findMany(),
  appointmentReminders: () => prisma.appointmentReminder.findMany(),
  clinicalNotes: () => prisma.clinicalNote.findMany(),
  dentalRecords: () => prisma.dentalRecord.findMany(),
  smsTemplates: () => prisma.smsTemplate.findMany(),
  smsLogs: () => prisma.smsLog.findMany(),
  smsProviderConfig: () => prisma.smsProviderConfig.findMany(),
  emailTemplates: () => prisma.emailTemplate.findMany(),
  practiceWeeklyReportConfig: () => prisma.practiceWeeklyReportConfig.findMany(),
  practiceWeeklyReportLogs: () => prisma.practiceWeeklyReportLog.findMany(),
  recurringMessageConfigs: () => prisma.recurringMessageConfig.findMany(),
  recurringMessageLogs: () => prisma.recurringMessageLog.findMany(),
  practiceSettings: () => prisma.practiceSetting.findMany(),
  practiceClosures: () => prisma.practiceClosure.findMany(),
  practiceWeeklyClosures: () => prisma.practiceWeeklyClosure.findMany(),
  auditLogs: () => prisma.auditLog.findMany(),
  suppliers: () => prisma.supplier.findMany(),
  products: () => prisma.product.findMany(),
  services: () => prisma.service.findMany(),
  stockMovements: () => prisma.stockMovement.findMany(),
  financeEntries: () => prisma.financeEntry.findMany(),
  patientPayments: () => prisma.patientPayment.findMany(),
  cashAdvances: () => prisma.cashAdvance.findMany(),
  recallRules: () => prisma.recallRule.findMany(),
  recalls: () => prisma.recall.findMany(),
  quotes: () => prisma.quote.findMany(),
  quoteItems: () => prisma.quoteItem.findMany(),
  anamnesisConditions: () => prisma.anamnesisCondition.findMany(),
  featureUpdates: () => prisma.featureUpdate.findMany(),
  featureUpdateDismissals: () => prisma.featureUpdateDismissal.findMany(),
  roleFeatureAccess: () => prisma.roleFeatureAccess.findMany(),
  userAwards: () => prisma.userAward.findMany(),
  featureInstructions: () => prisma.featureInstruction.findMany(),
  featureInstructionSteps: () => prisma.featureInstructionStep.findMany(),
  userInstructionProgress: () => prisma.userInstructionProgress.findMany(),
} as const;

type TableKey = keyof typeof tableQueries;
type ExportBody = {
  exportedAt: string;
  tables: TableKey[];
  data: Partial<Record<TableKey, unknown[]>> & JsonObject;
};

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
    const data: ExportBody["data"] = {};
    for (const table of selected) {
      data[table] = await tableQueries[table]();
    }

    const body: ExportBody = {
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
