import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { format, isValid, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

export const metadata = createPageMetadata(PAGE_TITLES.reportUscite);

export const revalidate = 60;

const ARCHIVE_PREFIX = "[ARCHIVIO] ";

type ReportUscitePageProps = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const parseExpenseDescription = (description: string) => {
  const parts = description.split(" · ").map((part) => part.trim()).filter(Boolean);
  const kind = parts[0] ?? "Spesa";
  const title = parts[1] ?? description;
  const supplier =
    parts.find((part) => part.startsWith("Fornitore: "))?.replace("Fornitore: ", "") ??
    "Senza fornitore";
  const material =
    parts.find((part) => part.startsWith("Materiale: "))?.replace("Materiale: ", "") ??
    "Non specificato";

  return {
    kind,
    title,
    supplier,
    material,
  };
};

export default async function ReportUscitePage({
  searchParams,
}: ReportUscitePageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedParams = (await searchParams) ?? {};
  
  // Date range logic
  const now = new Date();
  const defaultFrom = format(startOfMonth(now), "yyyy-MM-dd");
  const defaultTo = format(now, "yyyy-MM-dd");

  const fromParam = typeof resolvedParams.from === "string" ? resolvedParams.from : defaultFrom;
  const toParam = typeof resolvedParams.to === "string" ? resolvedParams.to : defaultTo;

  const startDate = new Date(`${fromParam}T00:00:00`);
  const endDate = new Date(`${toParam}T23:59:59.999`);

  const safeStartDate = isValid(startDate) ? startDate : startOfMonth(now);
  const safeEndDate = isValid(endDate) ? endDate : now;

  const entries = await prisma.financeEntry.findMany({
    where: {
      type: "EXPENSE",
      occurredAt: {
        gte: safeStartDate,
        lte: safeEndDate,
      },
      NOT: {
        description: { startsWith: ARCHIVE_PREFIX },
      },
    },
    orderBy: { occurredAt: "asc" },
  });

  const parsedEntries = entries.map((entry) => ({
    ...entry,
    parsed: parseExpenseDescription(entry.description),
  }));

  const totalExpenses = parsedEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  const bySupplier = new Map<
    string,
    {
      supplier: string;
      count: number;
      total: number;
    }
  >();
  const byMaterialType = new Map<
    string,
    {
      key: string;
      kind: string;
      material: string;
      count: number;
      total: number;
    }
  >();

  for (const entry of parsedEntries) {
    const amount = Number(entry.amount);
    const supplierSummary = bySupplier.get(entry.parsed.supplier) ?? {
      supplier: entry.parsed.supplier,
      count: 0,
      total: 0,
    };
    supplierSummary.count += 1;
    supplierSummary.total += amount;
    bySupplier.set(entry.parsed.supplier, supplierSummary);

    const materialKey = `${entry.parsed.kind}::${entry.parsed.material}`;
    const materialSummary = byMaterialType.get(materialKey) ?? {
      key: materialKey,
      kind: entry.parsed.kind,
      material: entry.parsed.material,
      count: 0,
      total: 0,
    };
    materialSummary.count += 1;
    materialSummary.total += amount;
    byMaterialType.set(materialKey, materialSummary);
  }

  const supplierSummaries = Array.from(bySupplier.values()).sort((a, b) => b.total - a.total);
  const materialSummaries = Array.from(byMaterialType.values()).sort((a, b) => b.total - a.total);

  const periodLabel = `${format(safeStartDate, "d MMM yyyy", { locale: it })} - ${format(safeEndDate, "d MMM yyyy", { locale: it })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Report Uscite</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Riepilogo delle uscite, organizzato per fornitore e tipologia materiale nel periodo selezionato.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            variant="primary"
            className="print:hidden"
          />
          <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-right dark:border-rose-900/40 dark:bg-rose-950/20">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
              Totale uscite
            </p>
            <p className="mt-1 text-xl font-semibold text-rose-900 dark:text-rose-200">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Seleziona periodo</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Visualizza i movimenti di uscita aggregati.
            </p>
          </div>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Dal
              </label>
              <input
                type="date"
                name="from"
                defaultValue={fromParam}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Al
              </label>
              <input
                type="date"
                name="to"
                defaultValue={toParam}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Applica
            </Button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Dettaglio uscite
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Periodo: {periodLabel}
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {parsedEntries.length} uscite
          </span>
        </div>

        {parsedEntries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            Nessuna uscita registrata per il periodo selezionato.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Descrizione</th>
                  <th className="px-4 py-3 text-left">Fornitore</th>
                  <th className="px-4 py-3 text-left">Tipologia</th>
                  <th className="px-4 py-3 text-left">Materiale</th>
                  <th className="px-4 py-3 text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {parsedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {format(entry.occurredAt, "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{entry.parsed.title}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{entry.parsed.supplier}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{entry.parsed.kind}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{entry.parsed.material}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-800 dark:text-rose-400">
                      {formatCurrency(Number(entry.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Riepilogo per fornitore</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Totali ordinati dal fornitore con maggior spesa.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {supplierSummaries.length} fornitori
            </span>
          </div>

          {supplierSummaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              Nessun fornitore da riepilogare.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Fornitore</th>
                    <th className="px-4 py-3 text-right">Movimenti</th>
                    <th className="px-4 py-3 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {supplierSummaries.map((supplier) => (
                    <tr key={supplier.supplier} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{supplier.supplier}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{supplier.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-800 dark:text-rose-400">
                        {formatCurrency(supplier.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Riepilogo per tipologia e materiale</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Totali aggregati per categoria di spesa e materiale associato.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {materialSummaries.length} gruppi
            </span>
          </div>

          {materialSummaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              Nessuna tipologia da riepilogare.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Tipologia</th>
                    <th className="px-4 py-3 text-left">Materiale</th>
                    <th className="px-4 py-3 text-right">Movimenti</th>
                    <th className="px-4 py-3 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {materialSummaries.map((item) => (
                    <tr key={item.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{item.kind}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{item.material}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{item.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-800 dark:text-rose-400">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
