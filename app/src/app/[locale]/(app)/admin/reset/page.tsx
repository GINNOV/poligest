import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ImportForm } from "../../magazzino/import-form";
import { LocalizedFileInput } from "@/components/localized-file-input";
import fs from "fs/promises";
import path from "path";

async function resetSystem(formData: FormData) {
  "use server";

  const adminUser = await requireUser([Role.ADMIN]);
  const confirmation = (formData.get("confirm") as string)?.trim();
  const seedDemo = (formData.get("seedDemo") as string) === "on";

  if (confirmation !== "Si, confermo") {
    throw new Error("Devi digitare 'Si, confermo' per procedere.");
  }

  // Wipe data respecting FK order
  await prisma.$transaction([
    prisma.smsLog.deleteMany(),
    prisma.smsTemplate.deleteMany(),
    prisma.smsProviderConfig.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.financeEntry.deleteMany(),
    prisma.cashAdvance.deleteMany(),
    prisma.dentalRecord.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.clinicalNote.deleteMany(),
    prisma.patientConsent.deleteMany(),
    prisma.recall.deleteMany(),
    prisma.recallRule.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.consentModule.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  if (seedDemo) {
    const seedPath = path.join(process.cwd(), "AI", "CONTENT", "poligest-export-generated.json");
    const raw = await fs.readFile(seedPath, "utf-8");
    const parsed = JSON.parse(raw);
    const data = parsed?.data ?? {};
    const selected: ExportTableKey[] = Array.isArray(parsed.tables)
      ? parsed.tables.filter((t: string) =>
          exportTables.some((table) => table.key === t)
        )
      : (exportTables.map((t) => t.key) as ExportTableKey[]);

    const tableData = (key: ExportTableKey) =>
      (data[key] as Record<string, any>[] | undefined) ?? [];

    const toDecimal = (value: unknown) =>
      new Prisma.Decimal(value === null || value === undefined ? 0 : (value as any));

    await prisma.$transaction(async (tx) => {
      if (selected.includes("users")) {
        const entries = tableData("users") as Prisma.UserCreateManyInput[];
        if (entries.length) {
          await tx.user.createMany({ data: entries });
        }
      }

      if (selected.includes("doctors")) {
        const entries = tableData("doctors") as Prisma.DoctorCreateManyInput[];
        if (entries.length) {
          await tx.doctor.createMany({ data: entries });
        }
      }

      if (selected.includes("patients")) {
        const entries = tableData("patients") as Prisma.PatientCreateManyInput[];
        if (entries.length) {
          await tx.patient.createMany({ data: entries });
        }
      }

      if (selected.includes("suppliers")) {
        const entries = tableData("suppliers") as Prisma.SupplierCreateManyInput[];
        if (entries.length) {
          await tx.supplier.createMany({ data: entries });
        }
      }

      if (selected.includes("products")) {
        const entries = (tableData("products") as Prisma.ProductCreateManyInput[]).map(
          (p) => ({
            ...p,
            unitCost:
              p.unitCost !== null && p.unitCost !== undefined ? toDecimal(p.unitCost) : null,
          })
        );
        if (entries.length) {
          await tx.product.createMany({ data: entries });
        }
      }

      if (selected.includes("recallRules")) {
        const entries = tableData("recallRules") as Prisma.RecallRuleCreateManyInput[];
        if (entries.length) {
          await tx.recallRule.createMany({ data: entries });
        }
      }

      if (selected.includes("consentModules")) {
        const entries = tableData("consentModules") as Prisma.ConsentModuleCreateManyInput[];
        if (entries.length) {
          await tx.consentModule.createMany({ data: entries });
        }
      }

      if (selected.includes("patientConsents")) {
        const entries = tableData("patientConsents") as Prisma.PatientConsentCreateManyInput[];
        if (entries.length) {
          await tx.patientConsent.createMany({ data: entries });
        }
      }

      if (selected.includes("appointments")) {
        const entries = tableData("appointments") as Prisma.AppointmentCreateManyInput[];
        if (entries.length) {
          await tx.appointment.createMany({ data: entries });
        }
      }

      if (selected.includes("clinicalNotes")) {
        const entries = tableData("clinicalNotes") as Prisma.ClinicalNoteCreateManyInput[];
        if (entries.length) {
          await tx.clinicalNote.createMany({ data: entries });
        }
      }

      if (selected.includes("stockMovements")) {
        const entries = tableData("stockMovements") as Prisma.StockMovementCreateManyInput[];
        if (entries.length) {
          await tx.stockMovement.createMany({ data: entries });
        }
      }

      if (selected.includes("financeEntries")) {
        const entries = (tableData("financeEntries") as Prisma.FinanceEntryCreateManyInput[]).map(
          (f) => ({
            ...f,
            amount: toDecimal(f.amount),
          })
        );
        if (entries.length) {
          await tx.financeEntry.createMany({ data: entries });
        }
      }

      if (selected.includes("cashAdvances")) {
        const entries = (tableData("cashAdvances") as Prisma.CashAdvanceCreateManyInput[]).map(
          (c) => {
            const candidatePatientId = (c as unknown as { patientId?: string; doctorId?: string }).patientId ?? (c as unknown as { doctorId?: string }).doctorId;
            return {
              ...c,
              patientId: candidatePatientId ?? "",
              amount: toDecimal(c.amount),
            };
          }
        );
        if (entries.length) {
          await tx.cashAdvance.createMany({ data: entries });
        }
      }

      if (selected.includes("recalls")) {
        const entries = tableData("recalls") as Prisma.RecallCreateManyInput[];
        if (entries.length) {
          await tx.recall.createMany({ data: entries });
        }
      }

      if (selected.includes("smsProviderConfig")) {
        const entries = tableData("smsProviderConfig") as Prisma.SmsProviderConfigCreateManyInput[];
        if (entries.length) {
          await tx.smsProviderConfig.createMany({ data: entries });
        }
      }

      if (selected.includes("smsTemplates")) {
        const entries = tableData("smsTemplates") as Prisma.SmsTemplateCreateManyInput[];
        if (entries.length) {
          await tx.smsTemplate.createMany({ data: entries });
        }
      }

      if (selected.includes("smsLogs")) {
        const entries = tableData("smsLogs") as Prisma.SmsLogCreateManyInput[];
        if (entries.length) {
          await tx.smsLog.createMany({ data: entries });
        }
      }

      if (selected.includes("auditLogs")) {
        const entries = tableData("auditLogs") as Prisma.AuditLogCreateManyInput[];
        if (entries.length) {
          await tx.auditLog.createMany({ data: entries });
        }
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
  { key: "patients", label: "Pazienti" },
  { key: "consentModules", label: "Moduli consenso" },
  { key: "patientConsents", label: "Consensi pazienti" },
  { key: "appointments", label: "Appuntamenti" },
  { key: "clinicalNotes", label: "Note cliniche" },
  { key: "smsTemplates", label: "Template SMS" },
  { key: "smsLogs", label: "Log SMS" },
  { key: "smsProviderConfig", label: "Config ClickSend" },
  { key: "auditLogs", label: "Audit log" },
  { key: "suppliers", label: "Fornitori" },
  { key: "products", label: "Prodotti" },
  { key: "stockMovements", label: "Movimenti magazzino" },
  { key: "financeEntries", label: "Finanza" },
  { key: "cashAdvances", label: "Anticipi" },
  { key: "recallRules", label: "Regole richiami" },
  { key: "recalls", label: "Richiami" },
] as const;

type ExportTableKey = (typeof exportTables)[number]["key"];

async function importData(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    throw new Error("Carica un file JSON valido.");
  }

  const content = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Il file non è un JSON valido.");
  }

  const data = parsed?.data;
  if (!data || typeof data !== "object") {
    throw new Error("Formato export non riconosciuto.");
  }

  const selected: ExportTableKey[] = Array.isArray(parsed.tables)
    ? parsed.tables.filter((t: string) =>
        exportTables.some((table) => table.key === t)
      )
    : (exportTables.map((t) => t.key) as ExportTableKey[]);

  const tableData = (key: ExportTableKey) =>
    (data[key] as Record<string, any>[] | undefined) ?? [];

  const toDecimal = (value: unknown) =>
    new Prisma.Decimal(value === null || value === undefined ? 0 : (value as any));

  await prisma.$transaction(async (tx) => {
    // wipe
    await tx.smsLog.deleteMany();
    await tx.smsTemplate.deleteMany();
    await tx.smsProviderConfig.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.financeEntry.deleteMany();
    await tx.cashAdvance.deleteMany();
    await tx.dentalRecord.deleteMany();
    await tx.appointment.deleteMany();
    await tx.clinicalNote.deleteMany();
    await tx.patientConsent.deleteMany();
    await tx.recall.deleteMany();
    await tx.recallRule.deleteMany();
    await tx.patient.deleteMany();
    await tx.consentModule.deleteMany();
    await tx.doctor.deleteMany();
    await tx.product.deleteMany();
    await tx.supplier.deleteMany();
    await tx.user.deleteMany();

    // restore
    if (selected.includes("users")) {
      const entries = tableData("users") as Prisma.UserCreateManyInput[];
      if (entries.length) {
        await tx.user.createMany({ data: entries });
      }
    }

    if (selected.includes("doctors")) {
      const entries = tableData("doctors") as Prisma.DoctorCreateManyInput[];
      if (entries.length) {
        await tx.doctor.createMany({ data: entries });
      }
    }

    if (selected.includes("patients")) {
      const entries = tableData("patients") as Prisma.PatientCreateManyInput[];
      if (entries.length) {
        await tx.patient.createMany({ data: entries });
      }
    }

    if (selected.includes("suppliers")) {
      const entries = tableData("suppliers") as Prisma.SupplierCreateManyInput[];
      if (entries.length) {
        await tx.supplier.createMany({ data: entries });
      }
    }

    if (selected.includes("products")) {
      const entries = (tableData("products") as Prisma.ProductCreateManyInput[]).map(
        (p) => ({
          ...p,
          unitCost:
            p.unitCost !== null && p.unitCost !== undefined ? toDecimal(p.unitCost) : null,
        })
      );
      if (entries.length) {
        await tx.product.createMany({ data: entries });
      }
    }

    if (selected.includes("recallRules")) {
      const entries = tableData("recallRules") as Prisma.RecallRuleCreateManyInput[];
      if (entries.length) {
        await tx.recallRule.createMany({ data: entries });
      }
    }

    if (selected.includes("consentModules")) {
      const entries = tableData("consentModules") as Prisma.ConsentModuleCreateManyInput[];
      if (entries.length) {
        await tx.consentModule.createMany({ data: entries });
      }
    }

    if (selected.includes("patientConsents")) {
      const entries = tableData("patientConsents") as Prisma.PatientConsentCreateManyInput[];
      if (entries.length) {
        await tx.patientConsent.createMany({ data: entries });
      }
    }

    if (selected.includes("appointments")) {
      const entries = tableData("appointments") as Prisma.AppointmentCreateManyInput[];
      if (entries.length) {
        await tx.appointment.createMany({ data: entries });
      }
    }

    if (selected.includes("clinicalNotes")) {
      const entries = tableData("clinicalNotes") as Prisma.ClinicalNoteCreateManyInput[];
      if (entries.length) {
        await tx.clinicalNote.createMany({ data: entries });
      }
    }

    if (selected.includes("stockMovements")) {
      const entries = tableData("stockMovements") as Prisma.StockMovementCreateManyInput[];
      if (entries.length) {
        await tx.stockMovement.createMany({ data: entries });
      }
    }

    if (selected.includes("financeEntries")) {
      const entries = (tableData("financeEntries") as Prisma.FinanceEntryCreateManyInput[]).map(
        (f) => ({
          ...f,
          amount: toDecimal(f.amount),
        })
      );
      if (entries.length) {
        await tx.financeEntry.createMany({ data: entries });
      }
    }

    if (selected.includes("cashAdvances")) {
      const entries = (tableData("cashAdvances") as Prisma.CashAdvanceCreateManyInput[]).map(
        (c) => {
          const candidatePatientId = (c as unknown as { patientId?: string; doctorId?: string }).patientId ?? (c as unknown as { doctorId?: string }).doctorId;
          return {
            ...c,
            patientId: candidatePatientId ?? "",
            amount: toDecimal(c.amount),
          };
        }
      );
      if (entries.length) {
        await tx.cashAdvance.createMany({ data: entries });
      }
    }

    if (selected.includes("recalls")) {
      const entries = tableData("recalls") as Prisma.RecallCreateManyInput[];
      if (entries.length) {
        await tx.recall.createMany({ data: entries });
      }
    }

    if (selected.includes("auditLogs")) {
      const entries = tableData("auditLogs") as Prisma.AuditLogCreateManyInput[];
      if (entries.length) {
        await tx.auditLog.createMany({ data: entries });
      }
    }

    if (selected.includes("smsProviderConfig")) {
      const entries = tableData("smsProviderConfig") as Prisma.SmsProviderConfigCreateManyInput[];
      if (entries.length) {
        await tx.smsProviderConfig.createMany({ data: entries });
      }
    }

    if (selected.includes("smsTemplates")) {
      const entries = tableData("smsTemplates") as Prisma.SmsTemplateCreateManyInput[];
      if (entries.length) {
        await tx.smsTemplate.createMany({ data: entries });
      }
    }

    if (selected.includes("smsLogs")) {
      const entries = tableData("smsLogs") as Prisma.SmsLogCreateManyInput[];
      if (entries.length) {
        await tx.smsLog.createMany({ data: entries });
      }
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
        <section className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                {t("reset")}
              </p>
              <h1 className="text-xl font-semibold text-rose-900">
                {t("resetTitle")}
              </h1>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {t("dangerZone")}
            </span>
          </div>
          <p className="text-sm text-rose-900">{t("resetDescription")}</p>
          <p className="text-sm font-semibold text-rose-800">
            {t("resetWarning")}
          </p>
          <form action={resetSystem} className="space-y-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-900">
              {t("resetConfirmLabel")}
              <input
                name="confirm"
                placeholder={t("resetConfirmPlaceholder")}
                className="h-11 rounded-xl border border-rose-200 px-3 text-base text-rose-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                autoComplete="off"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-rose-900">
              <input
                type="checkbox"
                name="seedDemo"
                defaultChecked
                className="h-4 w-4 rounded border-rose-300"
              />
              Ripristina anche i dati demo
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              {t("resetButton")}
            </button>
            <p className="text-xs text-rose-900">{t("resetFooterHint")}</p>
          </form>
        </section>

        <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {t("export")}
                </p>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {t("exportTitle")}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                JSON
              </span>
            </div>
            <p className="text-sm text-zinc-600">{t("exportDescription")}</p>
          </div>
          <form
            method="GET"
            action="/api/admin/export"
            className="space-y-4 text-sm text-zinc-800"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {exportTables.map((table) => (
                <label
                  key={table.key}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name="tables"
                    value={table.key}
                    defaultChecked
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>{table.label}</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              {t("exportButton")}
            </button>
          </form>

          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {t("import")}
                </p>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {t("importTitle")}
                </h3>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                JSON
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600">{t("importDescription")}</p>
            <form action={importData} className="mt-3 space-y-3 text-sm text-zinc-800">
              <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                {t("importLabel")}
                <LocalizedFileInput name="file" accept="application/json" required />
              </div>
              <p className="text-xs text-zinc-500">{t("importHint")}</p>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                {t("importButton")}
              </button>
            </form>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  Magazzino
                </p>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Import/Export magazzino
                </h3>
              </div>
              <Link
                href="/api/magazzino/export"
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Esporta CSV
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
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
