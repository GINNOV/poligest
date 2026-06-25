import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Admin Export Sync", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const exportRoutePath = path.join(process.cwd(), "src/app/api/admin/export/route.ts");
  const resetPagePath = path.join(process.cwd(), "src/app/[locale]/(app)/admin/reset/page.tsx");

  it("should include all prisma models in the export tableQueries", () => {
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const exportContent = fs.readFileSync(exportRoutePath, "utf-8");

    // Extract models from schema
    const models = [...schemaContent.matchAll(/^model\s+(\w+)\s+\{/gm)].map(m => m[1]);

    // Extract keys from tableQueries in export route
    // Matches "key: () => prisma.model.findMany()"
    const tableQueryKeys = [...exportContent.matchAll(/^\s+(\w+):\s+\(\)\s+=>\s+prisma\.\w+\.findMany\(\),/gm)].map(m => m[1]);

    // Check if each model has a corresponding entry in tableQueries
    // Note: Some models might be excluded intentionally, but for full backup they should be there.
    // We'll check if they are at least mentioned.
    
    // Mapping of Model Name to expected table key (if not simple camelCase)
    const modelToKey: Record<string, string> = {
        FeatureUpdate: "featureUpdates",
        FeatureUpdateDismissal: "featureUpdateDismissals",
        RoleFeatureAccess: "roleFeatureAccess",
        SmsTemplate: "smsTemplates",
        SmsLog: "smsLogs",
        SmsProviderConfig: "smsProviderConfig",
        WacomConfig: "wacomConfig",
        KapsoWhatsAppConfig: "kapsoWhatsAppConfig",
        User: "users",
        Doctor: "doctors",
        UserAward: "userAwards",
        DoctorAvailabilityWindow: "doctorAvailabilityWindows",
        DoctorTimeOff: "doctorTimeOffs",
        PracticeClosure: "practiceClosures",
        PracticeWeeklyClosure: "practiceWeeklyClosures",
        PracticeWeeklyReportConfig: "practiceWeeklyReportConfig",
        PracticeWeeklyReportLog: "practiceWeeklyReportLogs",
        RecurringMessageConfig: "recurringMessageConfigs",
        PracticeSetting: "practiceSettings",
        RecurringMessageLog: "recurringMessageLogs",
        Patient: "patients",
        ConsentModule: "consentModules",
        PatientConsent: "patientConsents",
        Appointment: "appointments",
        ClinicalNote: "clinicalNotes",
        DentalRecord: "dentalRecords",
        AuditLog: "auditLogs",
        Supplier: "suppliers",
        Product: "products",
        StockMovement: "stockMovements",
        FinanceEntry: "financeEntries",
        EmailTemplate: "emailTemplates",
        DailyReminderConfig: "dailyReminderConfig",
        DailyReminderLog: "dailyReminderLogs",
        CashAdvance: "cashAdvances",
        RecallRule: "recallRules",
        Recall: "recalls",
        AppointmentReminderRule: "appointmentReminderRules",
        AppointmentReminder: "appointmentReminders",
        Service: "services",
        AnamnesisCondition: "anamnesisConditions",
        Quote: "quotes",
        QuoteItem: "quoteItems",
        PatientPayment: "patientPayments",
        FeatureInstruction: "featureInstructions",
        FeatureInstructionStep: "featureInstructionSteps",
        UserInstructionProgress: "userInstructionProgress",
    };

    for (const model of models) {
        const expectedKey = modelToKey[model];
        expect(tableQueryKeys, `Model ${model} (expected key: ${expectedKey}) is missing from tableQueries in ${exportRoutePath}`).toContain(expectedKey);
    }
  });

  it("should include all exported tables in the Admin Reset page UI", () => {
    const exportContent = fs.readFileSync(exportRoutePath, "utf-8");
    const exportTablesPath = path.join(process.cwd(), "src/lib/admin/export-tables.ts");
    const exportTablesContent = fs.readFileSync(exportTablesPath, "utf-8");

    const tableQueryKeys = [...exportContent.matchAll(/^\s+(\w+):\s+\(\)\s+=>\s+prisma\.\w+\.findMany\(\),/gm)].map(m => m[1]);
    
    // Extract keys from exportTables in lib
    const exportTableKeys = [...exportTablesContent.matchAll(/key:\s+"(\w+)"/gm)].map(m => m[1]);

    for (const key of tableQueryKeys) {
        expect(exportTableKeys, `Table key ${key} is missing from exportTables in ${exportTablesPath}`).toContain(key);
    }
  });

  it("should include all exported tables in resetSystem deletion transaction", () => {
    const resetPageContent = fs.readFileSync(resetPagePath, "utf-8");
    const exportContent = fs.readFileSync(exportRoutePath, "utf-8");
    
    const tableQueryKeys = [...exportContent.matchAll(/^\s+(\w+):\s+\(\)\s+=>\s+prisma\.\w+\.findMany\(\),/gm)].map(m => m[1]);

    // Mapping table key to prisma model name for deletion
    const keyToModel: Record<string, string> = {
        users: "user",
        doctors: "doctor",
        doctorAvailabilityWindows: "doctorAvailabilityWindow",
        doctorTimeOffs: "doctorTimeOff",
        patients: "patient",
        consentModules: "consentModule",
        patientConsents: "patientConsent",
        appointments: "appointment",
        appointmentReminderRules: "appointmentReminderRule",
        appointmentReminders: "appointmentReminder",
        clinicalNotes: "clinicalNote",
        dentalRecords: "dentalRecord",
        smsTemplates: "smsTemplate",
        smsLogs: "smsLog",
        smsProviderConfig: "smsProviderConfig",
        wacomConfig: "wacomConfig",
        kapsoWhatsAppConfig: "kapsoWhatsAppConfig",
        emailTemplates: "emailTemplate",
        dailyReminderConfig: "dailyReminderConfig",
        dailyReminderLogs: "dailyReminderLog",
        practiceWeeklyReportConfig: "practiceWeeklyReportConfig",
        practiceWeeklyReportLogs: "practiceWeeklyReportLog",
        recurringMessageConfigs: "recurringMessageConfig",
        recurringMessageLogs: "recurringMessageLog",
        practiceSettings: "practiceSetting",
        practiceClosures: "practiceClosure",
        practiceWeeklyClosures: "practiceWeeklyClosure",
        auditLogs: "auditLog",
        suppliers: "supplier",
        products: "product",
        services: "service",
        stockMovements: "stockMovement",
        financeEntries: "financeEntry",
        patientPayments: "patientPayment",
        cashAdvances: "cashAdvance",
        recallRules: "recallRule",
        recalls: "recall",
        quotes: "quote",
        quoteItems: "quoteItem",
        anamnesisConditions: "anamnesisCondition",
        featureUpdates: "featureUpdate",
        featureUpdateDismissals: "featureUpdateDismissal",
        roleFeatureAccess: "roleFeatureAccess",
        userAwards: "userAward",
        featureInstructions: "featureInstruction",
        featureInstructionSteps: "featureInstructionStep",
        userInstructionProgress: "userInstructionProgress",
    };

    for (const key of tableQueryKeys) {
        const model = keyToModel[key];
        const deleteRegex = new RegExp(`prisma\\.${model}\\.deleteMany\\(\\)`, "g");
        expect(resetPageContent, `Model ${model} (from key ${key}) is missing from resetSystem deleteMany transaction in ${resetPagePath}`).toMatch(deleteRegex);
    }
  });
});
