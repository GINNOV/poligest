import { endOfMonth, format, isValid, parse, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

type ReportMediciPageProps = {
  searchParams?: Promise<{ month?: string; doctorId?: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default async function ReportMediciPage({
  searchParams,
}: ReportMediciPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedParams = (await searchParams) ?? {};
  const selectedDoctorId = resolvedParams.doctorId || "all";
  const defaultMonthDate = startOfMonth(new Date());
  const requestedMonth =
    typeof resolvedParams.month === "string" ? resolvedParams.month.trim() : "";
  const parsedMonth = requestedMonth ? parse(requestedMonth, "yyyy-MM", new Date()) : null;
  const safeMonthDate =
    parsedMonth && isValid(parsedMonth) ? startOfMonth(parsedMonth) : defaultMonthDate;
  const selectedMonthValue = format(safeMonthDate, "yyyy-MM");
  const monthStart = startOfMonth(safeMonthDate);
  const monthEnd = endOfMonth(safeMonthDate);

  const [doctors, entries] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.financeEntry.findMany({
      where: {
        occurredAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        doctorId: selectedDoctorId !== "all" ? selectedDoctorId : { not: null },
      },
      include: {
        doctor: { select: { fullName: true } },
      },
    }),
  ]);

  const doctorsMap = new Map<
    string,
    {
      id: string;
      name: string;
      totalIncome: number;
      totalExpense: number;
      balance: number;
      count: number;
    }
  >();

  for (const entry of entries) {
    if (!entry.doctorId) continue;
    const doctorId = entry.doctorId;
    const current = doctorsMap.get(doctorId) ?? {
      id: doctorId,
      name: entry.doctor?.fullName || "Medico Sconosciuto",
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      count: 0,
    };

    const amount = Number(entry.amount);
    if (entry.type === "INCOME") {
      current.totalIncome += amount;
    } else {
      current.totalExpense += amount;
    }
    current.count += 1;
    current.balance = current.totalIncome - current.totalExpense;

    doctorsMap.set(doctorId, current);
  }

  const doctorSummaries = Array.from(doctorsMap.values()).sort(
    (a, b) => b.totalIncome - a.totalIncome
  );

  const totalMonthIncome = doctorSummaries.reduce((sum, d) => sum + d.totalIncome, 0);
  const totalMonthExpense = doctorSummaries.reduce((sum, d) => sum + d.totalExpense, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Report Medici</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Riepilogo mensile dei compensi e dei pagamenti suddivisi per medico.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Totale Entrate Medici
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-900">{formatCurrency(totalMonthIncome)}</p>
            </div>
            <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                Totale Uscite (Liquidazioni)
              </p>
              <p className="mt-1 text-xl font-semibold text-rose-900">{formatCurrency(totalMonthExpense)}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Filtra report</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Seleziona il mese e il medico per visualizzare i dati.
            </p>
          </div>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Medico
              </label>
              <select
                name="doctorId"
                defaultValue={selectedDoctorId}
                className="h-11 min-w-[200px] rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">Tutti i medici</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Mese
              </label>
              <input
                type="month"
                name="month"
                defaultValue={selectedMonthValue}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-6 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Applica filtri
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Riepilogo Medici - {format(safeMonthDate, "MMMM yyyy", { locale: it })}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Compensi maturati e liquidazioni effettuate nel periodo.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {doctorSummaries.length} medici con movimenti
          </span>
        </div>

        {doctorSummaries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            Nessun movimento registrato per i medici nel mese selezionato.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Medico</th>
                  <th className="px-4 py-3 text-center">Movimenti</th>
                  <th className="px-4 py-3 text-right">Compensi (Entrate)</th>
                  <th className="px-4 py-3 text-right">Liquidazioni (Uscite)</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {doctorSummaries.map((summary) => (
                  <tr key={summary.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {summary.name}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-700">{summary.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {formatCurrency(summary.totalIncome)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">
                      {formatCurrency(summary.totalExpense)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${summary.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {formatCurrency(summary.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
