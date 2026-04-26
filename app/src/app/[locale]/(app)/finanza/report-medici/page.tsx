import { endOfMonth, format, isValid, parse, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { aggregateDoctorReport } from "@/lib/finance/reports";
import { ServicesChart } from "./services-chart";

export const revalidate = 60;

type ReportMediciPageProps = {
  searchParams?: Promise<{ from?: string; to?: string; doctorId?: string }>;
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

  const [doctors, financeEntries, appointments] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.financeEntry.findMany({
      where: {
        occurredAt: {
          gte: safeStartDate,
          lte: safeEndDate,
        },
        doctorId: selectedDoctorId !== "all" ? selectedDoctorId : { not: null },
      },
      include: {
        doctor: { select: { fullName: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.COMPLETED,
        startsAt: {
          gte: safeStartDate,
          lte: safeEndDate,
        },
        doctorId: selectedDoctorId !== "all" ? selectedDoctorId : { not: null },
      },
      include: {
        doctor: { select: { fullName: true } },
      },
    }),
  ]);

  const doctorSummaries = aggregateDoctorReport({ financeEntries, appointments });

  const totalIncome = doctorSummaries.reduce((sum, d) => sum + d.totalIncome, 0);
  const totalPatients = doctorSummaries.reduce((sum, d) => sum + d.patientCount, 0);

  const periodLabel = `${format(safeStartDate, "d MMM yyyy", { locale: it })} - ${format(safeEndDate, "d MMM yyyy", { locale: it })}`;

  // Aggregate global service distribution for chart
  const globalServiceCounts: Record<string, number> = {};
  for (const summary of doctorSummaries) {
    for (const [service, count] of Object.entries(summary.serviceCounts)) {
      globalServiceCounts[service] = (globalServiceCounts[service] || 0) + count;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Report Medici</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Analisi delle prestazioni, pazienti serviti e fatturato generato per ciascun medico.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            variant="primary"
            className="print:hidden"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-right dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Totale Fatturato Medici
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-200">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-right dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                Pazienti Serviti (Totale)
              </p>
              <p className="mt-1 text-xl font-semibold text-blue-900 dark:text-blue-200">{totalPatients}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Filtra report</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Seleziona l&apos;intervallo di date e il medico per visualizzare i dati.
            </p>
          </div>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Medico
              </label>
              <select
                name="doctorId"
                defaultValue={selectedDoctorId}
                className="h-11 min-w-[200px] rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
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
              Applica filtri
            </Button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Riepilogo per Medico
              </h2>
              <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Periodo: {periodLabel}
              </p>
            </div>
          </div>

          {doctorSummaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              Nessun dato registrato per i medici nel periodo selezionato.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Medico</th>
                    <th className="px-4 py-3 text-center">Pazienti Unici</th>
                    <th className="px-4 py-3 text-right">Fatturato (Entrate)</th>
                    <th className="px-4 py-3 text-right">Saldo Netto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {doctorSummaries.map((summary) => (
                    <tr key={summary.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {summary.name}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">
                        {summary.patientCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(summary.totalIncome)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${summary.balance >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                        {formatCurrency(summary.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Distribuzione Servizi
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tipologia di prestazioni effettuate nel periodo.
          </p>
          
          <div className="mt-6">
            {Object.keys(globalServiceCounts).length > 0 ? (
              <ServicesChart data={globalServiceCounts} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                Dati prestazioni non disponibili
              </div>
            )}
          </div>

          <div className="mt-6 space-y-2">
            {Object.entries(globalServiceCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([service, count]) => (
                <div key={service} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400 truncate mr-2">{service}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{count}</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
