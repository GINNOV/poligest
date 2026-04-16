import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ImportForm } from "../../magazzino/import-form";
import { LocalizedFileInput } from "@/components/localized-file-input";
import {
  IMPORT_CONFIRMATION_TEXT,
  RESET_CONFIRMATION_TEXT,
  assertBulkDestructiveActionEnabled,
  hasTypedConfirmation,
} from "@/lib/destructive-action-guard";
import type { JsonObject } from "@/lib/json-types";
import fs from "fs/promises";
import path from "path";

type ExportJson = {
  data?: Partial<Record<ExportTableKey, JsonObject[]>>;
  tables?: string[];
};

type DecimalInput = string | number | Prisma.Decimal;

const toDecimal = (value: unknown) =>
  new Prisma.Decimal(
    typeof value === "number" ||
      typeof value === "string" ||
      value instanceof Prisma.Decimal
      ? (value as DecimalInput)
      : typeof value === "bigint"
        ? value.toString()
      : 0
  );

async function resetSystem(formData: FormData) {
  "use server";

  const adminUser = await requireUser([Role.ADMIN]);
  const confirmation = (formData.get("confirm") as string)?.trim();
  const seedDemo = (formData.get("seedDemo") as string) === "on";

  assertBulkDestructiveActionEnabled();

  if (!hasTypedConfirmation(confirmation, RESET_CONFIRMATION_TEXT)) {
    throw new Error(`Devi digitare '${RESET_CONFIRMATION_TEXT}' per procedere.`);
  }

  // Wipe data respecting FK order
  await prisma.$transaction([
    prisma.userInstructionProgress.deleteMany(),
    prisma.featureInstructionStep.deleteMany(),
    prisma.featureInstruction.deleteMany(),
    prisma.featureUpdateDismissal.deleteMany(),
    prisma.featureUpdate.deleteMany(),
    prisma.roleFeatureAccess.deleteMany(),
    prisma.userAward.deleteMany(),
    prisma.smsLog.deleteMany(),
    prisma.smsTemplate.deleteMany(),
    prisma.smsProviderConfig.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.practiceWeeklyReportLog.deleteMany(),
    prisma.practiceWeeklyReportConfig.deleteMany(),
    prisma.recurringMessageLog.deleteMany(),
    prisma.recurringMessageConfig.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.patientPayment.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.service.deleteMany(),
    prisma.financeEntry.deleteMany(),
    prisma.cashAdvance.deleteMany(),
    prisma.appointmentReminder.deleteMany(),
    prisma.appointmentReminderRule.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.clinicalNote.deleteMany(),
    prisma.dentalRecord.deleteMany(),
    prisma.recall.deleteMany(),
    prisma.recallRule.deleteMany(),
    prisma.patientConsent.deleteMany(),
    prisma.consentModule.deleteMany(),
    prisma.doctorAvailabilityWindow.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.practiceClosure.deleteMany(),
    prisma.practiceWeeklyClosure.deleteMany(),
    prisma.practiceSetting.deleteMany(),
    prisma.anamnesisCondition.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  if (seedDemo) {
    const seedPath = path.join(process.cwd(), "AI", "CONTENT", "poligest-export-generated.json");
    const raw = await fs.readFile(seedPath, "utf-8");
    const parsed = JSON.parse(raw) as ExportJson;
    const data = parsed?.data ?? {};
    const selected: ExportTableKey[] = Array.isArray(parsed.tables)
      ? parsed.tables.filter(isExportTableKey)
      : [...exportTableKeys];

    const tableData = (key: ExportTableKey) =>
      data[key] ?? [];

    await prisma.$transaction(async (tx) => {
      // restore in correct FK order
      if (selected.includes("users")) {
        const entries = tableData("users") as Prisma.UserCreateManyInput[];
        if (entries.length) await tx.user.createMany({ data: entries });
      }

      if (selected.includes("doctors")) {
        const entries = tableData("doctors") as Prisma.DoctorCreateManyInput[];
        if (entries.length) await tx.doctor.createMany({ data: entries });
      }

      if (selected.includes("doctorAvailabilityWindows")) {
        const entries = tableData("doctorAvailabilityWindows") as Prisma.DoctorAvailabilityWindowCreateManyInput[];
        if (entries.length) await tx.doctorAvailabilityWindow.createMany({ data: entries });
      }

      if (selected.includes("patients")) {
        const entries = tableData("patients") as Prisma.PatientCreateManyInput[];
        if (entries.length) await tx.patient.createMany({ data: entries });
      }

      if (selected.includes("consentModules")) {
        const entries = tableData("consentModules") as Prisma.ConsentModuleCreateManyInput[];
        if (entries.length) await tx.consentModule.createMany({ data: entries });
      }

      if (selected.includes("recallRules")) {
        const entries = tableData("recallRules") as Prisma.RecallRuleCreateManyInput[];
        if (entries.length) await tx.recallRule.createMany({ data: entries });
      }

      if (selected.includes("appointmentReminders")) {
        const entries = tableData("appointmentReminders") as Prisma.AppointmentReminderCreateManyInput[];
        if (entries.length) await tx.appointmentReminder.createMany({ data: entries });
      }


      if (selected.includes("suppliers")) {
        const entries = tableData("suppliers") as Prisma.SupplierCreateManyInput[];
        if (entries.length) await tx.supplier.createMany({ data: entries });
      }

      if (selected.includes("products")) {
        const entries = (tableData("products") as Prisma.ProductCreateManyInput[]).map((p) => ({
          ...p,
          unitCost: p.unitCost !== null && p.unitCost !== undefined ? toDecimal(p.unitCost) : null,
        }));
        if (entries.length) await tx.product.createMany({ data: entries });
      }

      if (selected.includes("services")) {
        const entries = (tableData("services") as Prisma.ServiceCreateManyInput[]).map((s) => ({
          ...s,
          costBasis: toDecimal(s.costBasis),
        }));
        if (entries.length) await tx.service.createMany({ data: entries });
      }

      if (selected.includes("practiceSettings")) {
        const entries = tableData("practiceSettings") as Prisma.PracticeSettingCreateManyInput[];
        if (entries.length) await tx.practiceSetting.createMany({ data: entries });
      }

      if (selected.includes("practiceWeeklyClosures")) {
        const entries = tableData("practiceWeeklyClosures") as Prisma.PracticeWeeklyClosureCreateManyInput[];
        if (entries.length) await tx.practiceWeeklyClosure.createMany({ data: entries });
      }

      if (selected.includes("practiceClosures")) {
        const entries = tableData("practiceClosures") as Prisma.PracticeClosureCreateManyInput[];
        if (entries.length) await tx.practiceClosure.createMany({ data: entries });
      }

      if (selected.includes("anamnesisConditions")) {
        const entries = tableData("anamnesisConditions") as Prisma.AnamnesisConditionCreateManyInput[];
        if (entries.length) await tx.anamnesisCondition.createMany({ data: entries });
      }

      if (selected.includes("emailTemplates")) {
        const entries = tableData("emailTemplates") as Prisma.EmailTemplateCreateManyInput[];
        if (entries.length) await tx.emailTemplate.createMany({ data: entries });
      }

      if (selected.includes("featureInstructions")) {
        const entries = tableData("featureInstructions") as Prisma.FeatureInstructionCreateManyInput[];
        if (entries.length) await tx.featureInstruction.createMany({ data: entries });
      }

      if (selected.includes("featureInstructionSteps")) {
        const entries = tableData("featureInstructionSteps") as Prisma.FeatureInstructionStepCreateManyInput[];
        if (entries.length) await tx.featureInstructionStep.createMany({ data: entries });
      }

      if (selected.includes("featureUpdates")) {
        const entries = tableData("featureUpdates") as Prisma.FeatureUpdateCreateManyInput[];
        if (entries.length) await tx.featureUpdate.createMany({ data: entries });
      }

      if (selected.includes("roleFeatureAccess")) {
        const entries = tableData("roleFeatureAccess") as Prisma.RoleFeatureAccessCreateManyInput[];
        if (entries.length) await tx.roleFeatureAccess.createMany({ data: entries });
      }

      if (selected.includes("recurringMessageConfigs")) {
        const entries = tableData("recurringMessageConfigs") as Prisma.RecurringMessageConfigCreateManyInput[];
        if (entries.length) await tx.recurringMessageConfig.createMany({ data: entries });
      }

      if (selected.includes("patientConsents")) {
        const entries = tableData("patientConsents") as Prisma.PatientConsentCreateManyInput[];
        if (entries.length) await tx.patientConsent.createMany({ data: entries });
      }

      if (selected.includes("appointments")) {
        const entries = tableData("appointments") as Prisma.AppointmentCreateManyInput[];
        if (entries.length) await tx.appointment.createMany({ data: entries });
      }

      if (selected.includes("clinicalNotes")) {
        const entries = tableData("clinicalNotes") as Prisma.ClinicalNoteCreateManyInput[];
        if (entries.length) await tx.clinicalNote.createMany({ data: entries });
      }

      if (selected.includes("dentalRecords")) {
        const entries = tableData("dentalRecords") as Prisma.DentalRecordCreateManyInput[];
        if (entries.length) await tx.dentalRecord.createMany({ data: entries });
      }

      if (selected.includes("recalls")) {
        const entries = tableData("recalls") as Prisma.RecallCreateManyInput[];
        if (entries.length) await tx.recall.createMany({ data: entries });
      }

      if (selected.includes("stockMovements")) {
        const entries = tableData("stockMovements") as Prisma.StockMovementCreateManyInput[];
        if (entries.length) await tx.stockMovement.createMany({ data: entries });
      }

      if (selected.includes("financeEntries")) {
        const entries = (tableData("financeEntries") as Prisma.FinanceEntryCreateManyInput[]).map((f) => ({
          ...f,
          amount: toDecimal(f.amount),
        }));
        if (entries.length) await tx.financeEntry.createMany({ data: entries });
      }

      if (selected.includes("cashAdvances")) {
        const entries = (tableData("cashAdvances") as Prisma.CashAdvanceCreateManyInput[]).map((c) => ({
          ...c,
          amount: toDecimal(c.amount),
        }));
        if (entries.length) await tx.cashAdvance.createMany({ data: entries });
      }

      if (selected.includes("quotes")) {
        const entries = (tableData("quotes") as Prisma.QuoteCreateManyInput[]).map((q) => ({
          ...q,
          price: toDecimal(q.price),
          total: toDecimal(q.total),
        }));
        if (entries.length) await tx.quote.createMany({ data: entries });
      }

      if (selected.includes("quoteItems")) {
        const entries = (tableData("quoteItems") as Prisma.QuoteItemCreateManyInput[]).map((i) => ({
          ...i,
          price: toDecimal(i.price),
          total: toDecimal(i.total),
        }));
        if (entries.length) await tx.quoteItem.createMany({ data: entries });
      }

      if (selected.includes("patientPayments")) {
        const entries = (tableData("patientPayments") as Prisma.PatientPaymentCreateManyInput[]).map((p) => ({
          ...p,
          amount: toDecimal(p.amount),
        }));
        if (entries.length) await tx.patientPayment.createMany({ data: entries });
      }

      if (selected.includes("appointmentReminders")) {
        const entries = tableData("appointmentReminders") as Prisma.AppointmentReminderCreateManyInput[];
        if (entries.length) await tx.appointmentReminder.createMany({ data: entries });
      }


      if (selected.includes("practiceWeeklyReportConfig")) {
        const entries = tableData("practiceWeeklyReportConfig") as Prisma.PracticeWeeklyReportConfigCreateManyInput[];
        if (entries.length) await tx.practiceWeeklyReportConfig.createMany({ data: entries });
      }

      if (selected.includes("practiceWeeklyReportLogs")) {
        const entries = tableData("practiceWeeklyReportLogs") as Prisma.PracticeWeeklyReportLogCreateManyInput[];
        if (entries.length) await tx.practiceWeeklyReportLog.createMany({ data: entries });
      }

      if (selected.includes("recurringMessageLogs")) {
        const entries = tableData("recurringMessageLogs") as Prisma.RecurringMessageLogCreateManyInput[];
        if (entries.length) await tx.recurringMessageLog.createMany({ data: entries });
      }

      if (selected.includes("smsTemplates")) {
        const entries = tableData("smsTemplates") as Prisma.SmsTemplateCreateManyInput[];
        if (entries.length) await tx.smsTemplate.createMany({ data: entries });
      }

      if (selected.includes("smsLogs")) {
        const entries = tableData("smsLogs") as Prisma.SmsLogCreateManyInput[];
        if (entries.length) await tx.smsLog.createMany({ data: entries });
      }

      if (selected.includes("auditLogs")) {
        const entries = tableData("auditLogs") as Prisma.AuditLogCreateManyInput[];
        if (entries.length) await tx.auditLog.createMany({ data: entries });
      }

      if (selected.includes("featureUpdateDismissals")) {
        const entries = tableData("featureUpdateDismissals") as Prisma.FeatureUpdateDismissalCreateManyInput[];
        if (entries.length) await tx.featureUpdateDismissal.createMany({ data: entries });
      }

      if (selected.includes("userAwards")) {
        const entries = tableData("userAwards") as Prisma.UserAwardCreateManyInput[];
        if (entries.length) await tx.userAward.createMany({ data: entries });
      }

      if (selected.includes("userInstructionProgress")) {
        const entries = tableData("userInstructionProgress") as Prisma.UserInstructionProgressCreateManyInput[];
        if (entries.length) await tx.userInstructionProgress.createMany({ data: entries });
      }

      if (selected.includes("smsProviderConfig")) {
        const entries = tableData("smsProviderConfig") as Prisma.SmsProviderConfigCreateManyInput[];
        if (entries.length) await tx.smsProviderConfig.createMany({ data: entries });
      }
    });
  }

  await logAudit(adminUser, {
    action: "admin.reset_system",
    entity: "System",
    entityId: "reset",
  });

  revalidatePath("/admin/reset");
}

const exportTables = [
  { key: "users", label: "Utenti" },
  { key: "doctors", label: "Medici" },
  { key: "doctorAvailabilityWindows", label: "Orari medici" },
  { key: "patients", label: "Pazienti" },
  { key: "consentModules", label: "Moduli consenso" },
  { key: "patientConsents", label: "Consensi pazienti" },
  { key: "appointments", label: "Appuntamenti" },
  { key: "appointmentReminderRules", label: "Regole promemoria appuntamenti" },
  { key: "appointmentReminders", label: "Promemoria appuntamenti" },
  { key: "clinicalNotes", label: "Note cliniche" },
  { key: "dentalRecords", label: "Cartella clinica" },
  { key: "smsTemplates", label: "Template SMS" },
  { key: "smsLogs", label: "Log SMS" },
  { key: "smsProviderConfig", label: "Config ClickSend" },
  { key: "emailTemplates", label: "Template email" },
  { key: "practiceWeeklyReportConfig", label: "Config report settimanale" },
  { key: "practiceWeeklyReportLogs", label: "Log report settimanale" },
  { key: "recurringMessageConfigs", label: "Config messaggi ricorrenti" },
  { key: "recurringMessageLogs", label: "Log messaggi ricorrenti" },
  { key: "practiceSettings", label: "Impostazioni clinica" },
  { key: "practiceClosures", label: "Chiusure (ferie/permessi)" },
  { key: "practiceWeeklyClosures", label: "Chiusure settimanali" },
  { key: "auditLogs", label: "Audit log" },
  { key: "suppliers", label: "Fornitori" },
  { key: "products", label: "Prodotti" },
  { key: "services", label: "Prestazioni" },
  { key: "stockMovements", label: "Movimenti magazzino" },
  { key: "financeEntries", label: "Finanza" },
  { key: "patientPayments", label: "Pagamenti pazienti" },
  { key: "cashAdvances", label: "Anticipi" },
  { key: "recallRules", label: "Regole richiami" },
  { key: "recalls", label: "Richiami" },
  { key: "quotes", label: "Preventivi" },
  { key: "quoteItems", label: "Righe preventivo" },
  { key: "anamnesisConditions", label: "Condizioni anamnesi" },
  { key: "featureUpdates", label: "Aggiornamenti sistema" },
  { key: "featureUpdateDismissals", label: "Dismissal aggiornamenti" },
  { key: "roleFeatureAccess", label: "Accesso funzionalità" },
  { key: "userAwards", label: "Premi utenti" },
  { key: "featureInstructions", label: "Istruzioni funzionalità" },
  { key: "featureInstructionSteps", label: "Step istruzioni" },
  { key: "userInstructionProgress", label: "Progresso istruzioni utenti" },
] as const;

type ExportTableKey = (typeof exportTables)[number]["key"];
const exportTableKeys = new Set<ExportTableKey>(exportTables.map((table) => table.key));
const isExportTableKey = (value: string): value is ExportTableKey => exportTableKeys.has(value as ExportTableKey);

async function importData(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const file = formData.get("file");
  const confirmation = (formData.get("confirmImport") as string)?.trim();

  if (!file || typeof file === "string") {
    throw new Error("Carica un file JSON valido.");
  }

  assertBulkDestructiveActionEnabled();
  if (!hasTypedConfirmation(confirmation, IMPORT_CONFIRMATION_TEXT)) {
    throw new Error(`Devi digitare '${IMPORT_CONFIRMATION_TEXT}' per procedere.`);
  }

  const content = await file.text();
  let parsed: ExportJson;
  try {
    parsed = JSON.parse(content) as ExportJson;
  } catch {
    throw new Error("Il file non è un JSON valido.");
  }

  const data = parsed?.data;
  if (!data || typeof data !== "object") {
    throw new Error("Formato export non riconosciuto.");
  }

  const selected: ExportTableKey[] = Array.isArray(parsed.tables)
    ? parsed.tables.filter(isExportTableKey)
    : [...exportTableKeys];

  const tableData = (key: ExportTableKey) =>
    data[key] ?? [];

  await prisma.$transaction(async (tx) => {
    // wipe respecting FK order
    await tx.userInstructionProgress.deleteMany();
    await tx.featureInstructionStep.deleteMany();
    await tx.featureInstruction.deleteMany();
    await tx.featureUpdateDismissal.deleteMany();
    await tx.featureUpdate.deleteMany();
    await tx.roleFeatureAccess.deleteMany();
    await tx.userAward.deleteMany();
    await tx.smsLog.deleteMany();
    await tx.smsTemplate.deleteMany();
    await tx.smsProviderConfig.deleteMany();
    await tx.emailTemplate.deleteMany();
    await tx.practiceWeeklyReportLog.deleteMany();
    await tx.practiceWeeklyReportConfig.deleteMany();
    await tx.recurringMessageLog.deleteMany();
    await tx.recurringMessageConfig.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.patientPayment.deleteMany();
    await tx.quoteItem.deleteMany();
    await tx.quote.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.service.deleteMany();
    await tx.financeEntry.deleteMany();
    await tx.cashAdvance.deleteMany();
    await tx.appointmentReminder.deleteMany();
    await tx.appointmentReminderRule.deleteMany();
    await tx.appointment.deleteMany();
    await tx.clinicalNote.deleteMany();
    await tx.dentalRecord.deleteMany();
    await tx.recall.deleteMany();
    await tx.recallRule.deleteMany();
    await tx.patientConsent.deleteMany();
    await tx.consentModule.deleteMany();
    await tx.doctorAvailabilityWindow.deleteMany();
    await tx.doctor.deleteMany();
    await tx.patient.deleteMany();
    await tx.product.deleteMany();
    await tx.supplier.deleteMany();
    await tx.practiceClosure.deleteMany();
    await tx.practiceWeeklyClosure.deleteMany();
    await tx.practiceSetting.deleteMany();
    await tx.anamnesisCondition.deleteMany();
    await tx.user.deleteMany();

    // restore
    if (selected.includes("users")) {
      const entries = tableData("users") as Prisma.UserCreateManyInput[];
      if (entries.length) await tx.user.createMany({ data: entries });
    }

    if (selected.includes("doctors")) {
      const entries = tableData("doctors") as Prisma.DoctorCreateManyInput[];
      if (entries.length) await tx.doctor.createMany({ data: entries });
    }

    if (selected.includes("doctorAvailabilityWindows")) {
      const entries = tableData("doctorAvailabilityWindows") as Prisma.DoctorAvailabilityWindowCreateManyInput[];
      if (entries.length) await tx.doctorAvailabilityWindow.createMany({ data: entries });
    }

    if (selected.includes("patients")) {
      const entries = tableData("patients") as Prisma.PatientCreateManyInput[];
      if (entries.length) await tx.patient.createMany({ data: entries });
    }

    if (selected.includes("consentModules")) {
      const entries = tableData("consentModules") as Prisma.ConsentModuleCreateManyInput[];
      if (entries.length) await tx.consentModule.createMany({ data: entries });
    }

    if (selected.includes("recallRules")) {
      const entries = tableData("recallRules") as Prisma.RecallRuleCreateManyInput[];
      if (entries.length) await tx.recallRule.createMany({ data: entries });
    }

    if (selected.includes("appointmentReminders")) {
      const entries = tableData("appointmentReminders") as Prisma.AppointmentReminderCreateManyInput[];
      if (entries.length) await tx.appointmentReminder.createMany({ data: entries });
    }


    if (selected.includes("suppliers")) {
      const entries = tableData("suppliers") as Prisma.SupplierCreateManyInput[];
      if (entries.length) await tx.supplier.createMany({ data: entries });
    }

    if (selected.includes("products")) {
      const entries = (tableData("products") as Prisma.ProductCreateManyInput[]).map((p) => ({
        ...p,
        unitCost: p.unitCost !== null && p.unitCost !== undefined ? toDecimal(p.unitCost) : null,
      }));
      if (entries.length) await tx.product.createMany({ data: entries });
    }

    if (selected.includes("services")) {
      const entries = (tableData("services") as Prisma.ServiceCreateManyInput[]).map((s) => ({
        ...s,
        costBasis: toDecimal(s.costBasis),
      }));
      if (entries.length) await tx.service.createMany({ data: entries });
    }

    if (selected.includes("practiceSettings")) {
      const entries = tableData("practiceSettings") as Prisma.PracticeSettingCreateManyInput[];
      if (entries.length) await tx.practiceSetting.createMany({ data: entries });
    }

    if (selected.includes("practiceWeeklyClosures")) {
      const entries = tableData("practiceWeeklyClosures") as Prisma.PracticeWeeklyClosureCreateManyInput[];
      if (entries.length) await tx.practiceWeeklyClosure.createMany({ data: entries });
    }

    if (selected.includes("practiceClosures")) {
      const entries = tableData("practiceClosures") as Prisma.PracticeClosureCreateManyInput[];
      if (entries.length) await tx.practiceClosure.createMany({ data: entries });
    }

    if (selected.includes("anamnesisConditions")) {
      const entries = tableData("anamnesisConditions") as Prisma.AnamnesisConditionCreateManyInput[];
      if (entries.length) await tx.anamnesisCondition.createMany({ data: entries });
    }

    if (selected.includes("emailTemplates")) {
      const entries = tableData("emailTemplates") as Prisma.EmailTemplateCreateManyInput[];
      if (entries.length) await tx.emailTemplate.createMany({ data: entries });
    }

    if (selected.includes("featureInstructions")) {
      const entries = tableData("featureInstructions") as Prisma.FeatureInstructionCreateManyInput[];
      if (entries.length) await tx.featureInstruction.createMany({ data: entries });
    }

    if (selected.includes("featureInstructionSteps")) {
      const entries = tableData("featureInstructionSteps") as Prisma.FeatureInstructionStepCreateManyInput[];
      if (entries.length) await tx.featureInstructionStep.createMany({ data: entries });
    }

    if (selected.includes("featureUpdates")) {
      const entries = tableData("featureUpdates") as Prisma.FeatureUpdateCreateManyInput[];
      if (entries.length) await tx.featureUpdate.createMany({ data: entries });
    }

    if (selected.includes("roleFeatureAccess")) {
      const entries = tableData("roleFeatureAccess") as Prisma.RoleFeatureAccessCreateManyInput[];
      if (entries.length) await tx.roleFeatureAccess.createMany({ data: entries });
    }

    if (selected.includes("recurringMessageConfigs")) {
      const entries = tableData("recurringMessageConfigs") as Prisma.RecurringMessageConfigCreateManyInput[];
      if (entries.length) await tx.recurringMessageConfig.createMany({ data: entries });
    }

    if (selected.includes("patientConsents")) {
      const entries = tableData("patientConsents") as Prisma.PatientConsentCreateManyInput[];
      if (entries.length) await tx.patientConsent.createMany({ data: entries });
    }

    if (selected.includes("appointments")) {
      const entries = tableData("appointments") as Prisma.AppointmentCreateManyInput[];
      if (entries.length) await tx.appointment.createMany({ data: entries });
    }

    if (selected.includes("clinicalNotes")) {
      const entries = tableData("clinicalNotes") as Prisma.ClinicalNoteCreateManyInput[];
      if (entries.length) await tx.clinicalNote.createMany({ data: entries });
    }

    if (selected.includes("dentalRecords")) {
      const entries = tableData("dentalRecords") as Prisma.DentalRecordCreateManyInput[];
      if (entries.length) await tx.dentalRecord.createMany({ data: entries });
    }

    if (selected.includes("recalls")) {
      const entries = tableData("recalls") as Prisma.RecallCreateManyInput[];
      if (entries.length) await tx.recall.createMany({ data: entries });
    }

    if (selected.includes("stockMovements")) {
      const entries = tableData("stockMovements") as Prisma.StockMovementCreateManyInput[];
      if (entries.length) await tx.stockMovement.createMany({ data: entries });
    }

    if (selected.includes("financeEntries")) {
      const entries = (tableData("financeEntries") as Prisma.FinanceEntryCreateManyInput[]).map((f) => ({
        ...f,
        amount: toDecimal(f.amount),
      }));
      if (entries.length) await tx.financeEntry.createMany({ data: entries });
    }

    if (selected.includes("cashAdvances")) {
      const entries = (tableData("cashAdvances") as Prisma.CashAdvanceCreateManyInput[]).map((c) => ({
        ...c,
        amount: toDecimal(c.amount),
      }));
      if (entries.length) await tx.cashAdvance.createMany({ data: entries });
    }

    if (selected.includes("quotes")) {
      const entries = (tableData("quotes") as Prisma.QuoteCreateManyInput[]).map((q) => ({
        ...q,
        price: toDecimal(q.price),
        total: toDecimal(q.total),
      }));
      if (entries.length) await tx.quote.createMany({ data: entries });
    }

    if (selected.includes("quoteItems")) {
      const entries = (tableData("quoteItems") as Prisma.QuoteItemCreateManyInput[]).map((i) => ({
        ...i,
        price: toDecimal(i.price),
        total: toDecimal(i.total),
      }));
      if (entries.length) await tx.quoteItem.createMany({ data: entries });
    }

    if (selected.includes("patientPayments")) {
      const entries = (tableData("patientPayments") as Prisma.PatientPaymentCreateManyInput[]).map((p) => ({
        ...p,
        amount: toDecimal(p.amount),
      }));
      if (entries.length) await tx.patientPayment.createMany({ data: entries });
    }

    if (selected.includes("appointmentReminders")) {
      const entries = tableData("appointmentReminders") as Prisma.AppointmentReminderCreateManyInput[];
      if (entries.length) await tx.appointmentReminder.createMany({ data: entries });
    }


    if (selected.includes("practiceWeeklyReportConfig")) {
      const entries = tableData("practiceWeeklyReportConfig") as Prisma.PracticeWeeklyReportConfigCreateManyInput[];
      if (entries.length) await tx.practiceWeeklyReportConfig.createMany({ data: entries });
    }

    if (selected.includes("practiceWeeklyReportLogs")) {
      const entries = tableData("practiceWeeklyReportLogs") as Prisma.PracticeWeeklyReportLogCreateManyInput[];
      if (entries.length) await tx.practiceWeeklyReportLog.createMany({ data: entries });
    }

    if (selected.includes("recurringMessageLogs")) {
      const entries = tableData("recurringMessageLogs") as Prisma.RecurringMessageLogCreateManyInput[];
      if (entries.length) await tx.recurringMessageLog.createMany({ data: entries });
    }

    if (selected.includes("smsTemplates")) {
      const entries = tableData("smsTemplates") as Prisma.SmsTemplateCreateManyInput[];
      if (entries.length) await tx.smsTemplate.createMany({ data: entries });
    }

    if (selected.includes("smsLogs")) {
      const entries = tableData("smsLogs") as Prisma.SmsLogCreateManyInput[];
      if (entries.length) await tx.smsLog.createMany({ data: entries });
    }

    if (selected.includes("auditLogs")) {
      const entries = tableData("auditLogs") as Prisma.AuditLogCreateManyInput[];
      if (entries.length) await tx.auditLog.createMany({ data: entries });
    }

    if (selected.includes("featureUpdateDismissals")) {
      const entries = tableData("featureUpdateDismissals") as Prisma.FeatureUpdateDismissalCreateManyInput[];
      if (entries.length) await tx.featureUpdateDismissal.createMany({ data: entries });
    }

    if (selected.includes("userAwards")) {
      const entries = tableData("userAwards") as Prisma.UserAwardCreateManyInput[];
      if (entries.length) await tx.userAward.createMany({ data: entries });
    }

    if (selected.includes("userInstructionProgress")) {
      const entries = tableData("userInstructionProgress") as Prisma.UserInstructionProgressCreateManyInput[];
      if (entries.length) await tx.userInstructionProgress.createMany({ data: entries });
    }

    if (selected.includes("smsProviderConfig")) {
      const entries = tableData("smsProviderConfig") as Prisma.SmsProviderConfigCreateManyInput[];
      if (entries.length) await tx.smsProviderConfig.createMany({ data: entries });
    }
  });

  await logAudit(admin, {
    action: "admin.import_data",
    entity: "System",
    entityId: "import",
    metadata: { tables: selected },
  });

  revalidatePath("/admin/reset");
}

export default async function ResetPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                {t("reset")}
              </p>
              <h1 className="text-xl font-semibold text-rose-900 dark:text-rose-200">
                {t("resetTitle")}
              </h1>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-900/30">
              {t("dangerZone")}
            </span>
          </div>
          <p className="text-sm text-rose-900 dark:text-rose-200">{t("resetDescription")}</p>
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
            {t("resetWarning")}
          </p>
          <form action={resetSystem} className="space-y-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-900 dark:text-rose-200">
              {t("resetConfirmLabel")}
              <input
                name="confirm"
                placeholder={t("resetConfirmPlaceholder")}
                className="h-11 rounded-xl border border-rose-200 bg-white px-3 text-base text-rose-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-100 dark:placeholder:text-rose-900/50 dark:focus:border-rose-700 dark:focus:ring-rose-900/20"
                autoComplete="off"
              />
            </label>
            <p className="text-xs text-rose-900 dark:text-rose-400">
              Questa azione richiede la variabile ambiente
              <code className="ml-1 rounded bg-white/70 px-1 py-0.5 dark:bg-rose-900/40 dark:text-rose-200">
                ALLOW_BULK_DESTRUCTIVE_ACTIONS=true
              </code>
              .
            </p>
            <label className="flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-200">
              <input
                type="checkbox"
                name="seedDemo"
                defaultChecked
                className="h-4 w-4 rounded border-rose-300 dark:border-rose-800 dark:bg-rose-950"
              />
              Ripristina anche i dati demo
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              {t("resetButton")}
            </button>
            <p className="text-xs text-rose-900 dark:text-rose-400">{t("resetFooterHint")}</p>
          </form>
        </section>

        <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  {t("export")}
                </p>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {t("exportTitle")}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                JSON
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("exportDescription")}</p>
          </div>
          <form
            method="GET"
            action="/api/admin/export"
            className="space-y-4 text-sm text-zinc-800 dark:text-zinc-200"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {exportTables.map((table) => (
                <label
                  key={table.key}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <input
                    type="checkbox"
                    name="tables"
                    value={table.key}
                    defaultChecked
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <span>{table.label}</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {t("exportButton")}
            </button>
          </form>

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  {t("import")}
                </p>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {t("importTitle")}
                </h3>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                JSON
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("importDescription")}</p>
            <form action={importData} className="mt-3 space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {t("importLabel")}
                <LocalizedFileInput name="file" accept="application/json" required />
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Digita <span className="font-semibold dark:text-zinc-50">{IMPORT_CONFIRMATION_TEXT}</span> per
                confermare l&apos;import che sovrascrive i dati esistenti
                <input
                  name="confirmImport"
                  placeholder={IMPORT_CONFIRMATION_TEXT}
                  autoComplete="off"
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-700 dark:focus:ring-zinc-900"
                  required
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("importHint")}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                L&apos;import distruttivo richiede anche
                <code className="ml-1 rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900 dark:text-zinc-300">
                  ALLOW_BULK_DESTRUCTIVE_ACTIONS=true
                </code>
                .
              </p>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {t("importButton")}
              </button>
            </form>
          </div>

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  Magazzino
                </p>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Import/Export magazzino
                </h3>
              </div>
              <Link
                href="/api/magazzino/export"
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Esporta CSV
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Carica un file CSV con movimenti o scarica lo stato attuale dell&apos;inventario.
            </p>
            <div className="mt-3">
              <ImportForm />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
