import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
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
  isBulkDestructiveActionEnabled,
} from "@/lib/destructive-action-guard";
import type { JsonObject } from "@/lib/json-types";
import fs from "fs/promises";
import path from "path";
import { Button } from "@/components/ui/button";
import { ExportTableKey, isExportTableKey, exportTableKeys } from "@/lib/admin/export-tables";
import { ConfigExportForm } from "@/components/admin/config-export-form";

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
    prisma.wacomConfig.deleteMany(),
    prisma.kapsoWhatsAppConfig.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.dailyReminderLog.deleteMany(),
    prisma.dailyReminderConfig.deleteMany(),
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
    prisma.doctorTimeOff.deleteMany(),
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

      if (selected.includes("doctorTimeOffs")) {
        const entries = tableData("doctorTimeOffs") as Prisma.DoctorTimeOffCreateManyInput[];
        if (entries.length) await tx.doctorTimeOff.createMany({ data: entries });
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

      if (selected.includes("wacomConfig")) {
        const entries = tableData("wacomConfig") as Prisma.WacomConfigCreateManyInput[];
        if (entries.length) await tx.wacomConfig.createMany({ data: entries });
      }

      if (selected.includes("kapsoWhatsAppConfig")) {
        const entries = tableData("kapsoWhatsAppConfig") as Prisma.KapsoWhatsAppConfigCreateManyInput[];
        if (entries.length) await tx.kapsoWhatsAppConfig.createMany({ data: entries });
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
    await tx.wacomConfig.deleteMany();
    await tx.kapsoWhatsAppConfig.deleteMany();
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
    await tx.doctorTimeOff.deleteMany();
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

    if (selected.includes("doctorTimeOffs")) {
      const entries = tableData("doctorTimeOffs") as Prisma.DoctorTimeOffCreateManyInput[];
      if (entries.length) await tx.doctorTimeOff.createMany({ data: entries });
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

    if (selected.includes("wacomConfig")) {
      const entries = tableData("wacomConfig") as Prisma.WacomConfigCreateManyInput[];
      if (entries.length) await tx.wacomConfig.createMany({ data: entries });
    }

    if (selected.includes("kapsoWhatsAppConfig")) {
      const entries = tableData("kapsoWhatsAppConfig") as Prisma.KapsoWhatsAppConfigCreateManyInput[];
      if (entries.length) await tx.kapsoWhatsAppConfig.createMany({ data: entries });
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

export const metadata = createPageMetadata(PAGE_TITLES.resetDatabase);

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser([Role.ADMIN]);
  const isBulkEnabled = isBulkDestructiveActionEnabled();
  const { tab: activeTab = "export" } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Manutenzione Sistema</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Gestisci i dati, backup e ripristino del database.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isBulkEnabled 
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isBulkEnabled ? "bg-emerald-500" : "bg-amber-500"}`} />
            Bulk Actions: {isBulkEnabled ? "Abilitate" : "Disabilitate"}
          </div>
        </div>

        <div className="mt-8 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          <Link
            href="/admin/reset?tab=export"
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${
              activeTab === "export"
                ? "bg-white text-emerald-800 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Esportazione
          </Link>
          <Link
            href="/admin/reset?tab=import"
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${
              activeTab === "import"
                ? "bg-white text-amber-800 shadow-sm dark:bg-zinc-800 dark:text-amber-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Importazione
          </Link>
          <Link
            href="/admin/reset?tab=reset"
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${
              activeTab === "reset"
                ? "bg-white text-rose-800 shadow-sm dark:bg-zinc-800 dark:text-rose-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Reset Totale
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === "export" && (
          <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Configura Esportazione</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Scarica i dati del database in formato JSON per backup o migrazione.</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/api/magazzino/export"
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Esporta Magazzino (CSV)
                </Link>
              </div>
            </div>

            <ConfigExportForm />
          </section>
        )}

        {activeTab === "import" && (
          <section className="space-y-6">
             {!isBulkEnabled && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">⚠️</div>
                    <div>
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Importazione Disabilitata</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">L&apos;importazione massiva richiede l&apos;impostazione di <code>ALLOW_BULK_DESTRUCTIVE_ACTIONS=true</code> nel server.</p>
                    </div>
                  </div>
                </div>
              )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Ripristino da Backup</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sostituisci i dati attuali con quelli contenuti in un file JSON esportato in precedenza.</p>
              </div>
              
              <div className="mt-6 rounded-xl bg-rose-50 p-4 text-xs text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
                <p className="font-bold uppercase tracking-wider">Pericolo: Azione Distruttiva</p>
                <p className="mt-1 font-medium">L&apos;importazione cancellerà TUTTI i dati attuali nelle tabelle coinvolte prima di inserire quelli nuovi. Assicurati di avere una copia dei dati correnti.</p>
              </div>

              <form action={importData} className="mt-8 space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-zinc-900 dark:text-zinc-50 pl-1">Seleziona file backup (.json)</label>
                  <LocalizedFileInput name="file" accept="application/json" required />
                </div>

                <div className="space-y-3">
                   <label className="flex flex-col gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50 pl-1">
                    Conferma l&apos;operazione
                    <p className="text-xs font-medium text-zinc-500 italic">Digita &quot;{IMPORT_CONFIRMATION_TEXT}&quot; per sbloccare l&apos;import.</p>
                    <input
                      name="confirmImport"
                      placeholder={IMPORT_CONFIRMATION_TEXT}
                      autoComplete="off"
                      disabled={!isBulkEnabled}
                      className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-700"
                      required
                    />
                  </label>
                </div>

                <Button 
                  type="submit" 
                  variant="black" 
                  disabled={!isBulkEnabled}
                  size="lg"
                  className="w-full rounded-full font-bold shadow-lg"
                >
                  Avvia Importazione Massiva
                </Button>
              </form>
            </div>

            <div className="pg-card-base">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Importazione Magazzino (CSV)</h3>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase dark:bg-zinc-800">Parziale</span>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aggiorna le quantità o i prezzi dell&apos;inventario senza cancellare le anagrafiche.</p>
              <div className="mt-4">
                <ImportForm />
              </div>
            </div>
          </section>
        )}

        {activeTab === "reset" && (
          <section className="space-y-6">
            {!isBulkEnabled && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">⚠️</div>
                    <div>
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Reset Disabilitato</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Il reset richiede l&apos;impostazione di <code>ALLOW_BULK_DESTRUCTIVE_ACTIONS=true</code>.</p>
                    </div>
                  </div>
                </div>
              )}

            <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-8 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-rose-900 dark:text-rose-200">Reset Totale Sistema</h2>
                  <p className="mt-2 text-sm text-rose-800 dark:text-rose-300/80">Questa è l&apos;azione più pericolosa. Cancella ogni dato presente nel database.</p>
                </div>
                <div className="rounded-full bg-rose-600 px-4 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">Danger</div>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl bg-white/60 p-5 dark:bg-zinc-950/40">
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300">Cosa verrà rimosso:</h3>
                  <ul className="space-y-2 text-xs font-medium text-rose-800 dark:text-rose-400/80">
                    <li className="flex items-center gap-2">❌ Tutti gli Utenti (tranne te)</li>
                    <li className="flex items-center gap-2">❌ Tutte le Schede Paziente</li>
                    <li className="flex items-center gap-2">❌ Tutti gli Appuntamenti</li>
                    <li className="flex items-center gap-2">❌ Tutta la Contabilità e Fatture</li>
                    <li className="flex items-center gap-2">❌ Tutte le Configurazioni Clinica</li>
                  </ul>
                </div>

                <form action={resetSystem} className="space-y-6">
                  <label className="flex flex-col gap-2 text-sm font-bold text-rose-900 dark:text-rose-300">
                    Conferma con testo
                    <p className="text-[11px] font-medium opacity-70 italic">Digita &quot;{RESET_CONFIRMATION_TEXT}&quot;</p>
                    <input
                      name="confirm"
                      placeholder={RESET_CONFIRMATION_TEXT}
                      disabled={!isBulkEnabled}
                      className="h-12 rounded-xl border border-rose-200 bg-white px-4 text-base text-rose-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-100"
                      autoComplete="off"
                      required
                    />
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-rose-100 bg-white/50 px-4 py-3 transition hover:bg-white dark:border-rose-900/30 dark:bg-zinc-950/50 dark:hover:bg-zinc-950">
                    <input
                      type="checkbox"
                      name="seedDemo"
                      defaultChecked
                      disabled={!isBulkEnabled}
                      className="h-5 w-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 dark:border-rose-900 dark:bg-zinc-900"
                    />
                    <span className="text-sm font-bold text-rose-900 dark:text-rose-300">Ripristina Dati Demo (Setup Iniziale)</span>
                  </label>

                  <Button 
                    type="submit" 
                    variant="destructive" 
                    size="lg"
                    disabled={!isBulkEnabled}
                    className="w-full rounded-full h-14 text-lg font-black shadow-xl shadow-rose-200 dark:shadow-none"
                  >
                    WIPE DATABASE & RESET
                  </Button>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
