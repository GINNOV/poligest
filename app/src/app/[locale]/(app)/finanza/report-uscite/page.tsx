import { endOfMonth, format, isValid, parse, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type ReportUscitePageProps = {
  searchParams?: Promise<{ month?: string }>;
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
  const defaultMonthDate = startOfMonth(subMonths(new Date(), 1));
  const requestedMonth =
    typeof resolvedParams.month === "string" ? resolvedParams.month.trim() : "";
  const parsedMonth = requestedMonth ? parse(requestedMonth, "yyyy-MM", new Date()) : null;
  const safeMonthDate =
    parsedMonth && isValid(parsedMonth) ? startOfMonth(parsedMonth) : defaultMonthDate;
  const selectedMonthValue = format(safeMonthDate, "yyyy-MM");
  const monthStart = startOfMonth(safeMonthDate);
  const monthEnd = endOfMonth(safeMonthDate);

  const entries = await prisma.financeEntry.findMany({
    where: {
      type: "EXPENSE",
      occurredAt: {
        gte: monthStart,
        lte: monthEnd,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-zinc-600">Finanza</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Report Uscite</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Riepilogo mensile delle uscite, organizzato per fornitore e tipologia materiale.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
          />
          <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              Totale uscite
            </p>
            <p className="mt-1 text-xl font-semibold text-rose-900">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Seleziona il mese</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Per default viene mostrato il mese precedente.
            </p>
          </div>
          <form className="flex flex-col gap-2 sm:min-w-56">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Mese
            </label>
            <input
              type="month"
              name="month"
              defaultValue={selectedMonthValue}
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Applica
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Dettaglio uscite di {format(safeMonthDate, "MMMM yyyy", { locale: it })}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Ogni riga mostra una spesa registrata nel mese selezionato.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {parsedEntries.length} uscite
          </span>
        </div>

        {parsedEntries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            Nessuna uscita registrata per il mese selezionato.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Descrizione</th>
                  <th className="px-4 py-3 text-left">Fornitore</th>
                  <th className="px-4 py-3 text-left">Tipologia</th>
                  <th className="px-4 py-3 text-left">Materiale</th>
                  <th className="px-4 py-3 text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {parsedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-zinc-700">
                      {format(entry.occurredAt, "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-3 text-zinc-900">{entry.parsed.title}</td>
                    <td className="px-4 py-3 text-zinc-700">{entry.parsed.supplier}</td>
                    <td className="px-4 py-3 text-zinc-700">{entry.parsed.kind}</td>
                    <td className="px-4 py-3 text-zinc-700">{entry.parsed.material}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-800">
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
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Riepilogo per fornitore</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Totali ordinati dal fornitore con maggior spesa.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {supplierSummaries.length} fornitori
            </span>
          </div>

          {supplierSummaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
              Nessun fornitore da riepilogare.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Fornitore</th>
                    <th className="px-4 py-3 text-right">Movimenti</th>
                    <th className="px-4 py-3 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {supplierSummaries.map((supplier) => (
                    <tr key={supplier.supplier}>
                      <td className="px-4 py-3 text-zinc-900">{supplier.supplier}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{supplier.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-800">
                        {formatCurrency(supplier.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Riepilogo per tipologia e materiale</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Totali aggregati per categoria di spesa e materiale associato.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {materialSummaries.length} gruppi
            </span>
          </div>

          {materialSummaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
              Nessuna tipologia da riepilogare.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Tipologia</th>
                    <th className="px-4 py-3 text-left">Materiale</th>
                    <th className="px-4 py-3 text-right">Movimenti</th>
                    <th className="px-4 py-3 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {materialSummaries.map((item) => (
                    <tr key={item.key}>
                      <td className="px-4 py-3 text-zinc-900">{item.kind}</td>
                      <td className="px-4 py-3 text-zinc-700">{item.material}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{item.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-800">
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
