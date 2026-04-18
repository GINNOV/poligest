import { endOfMonth, format, isValid, parse, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { PatientPaymentMethod, Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type ReportMensilePageProps = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default async function ReportMensilePage({
  searchParams,
}: ReportMensilePageProps) {
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
      type: "INCOME",
      occurredAt: {
        gte: safeStartDate,
        lte: safeEndDate,
      },
      NOT: {
        description: { startsWith: ARCHIVE_PREFIX },
      },
    },
    orderBy: { occurredAt: "asc" },
    include: {
      doctor: { select: { fullName: true } },
    },
  });

  const patientPaymentClient = getOptionalPrismaModel<{
    findMany?: (args: {
      where: { paidAt: { gte: Date; lte: Date } };
      select: { amount: true; paidAt: true; method: true; note: true };
      orderBy: { paidAt: "asc" | "desc" };
    }) => Promise<
      Array<{
        amount: { toString(): string };
        paidAt: Date;
        method: PatientPaymentMethod;
        note: string | null;
      }>
    >;
  }>("patientPayment");

  const patientPayments = patientPaymentClient?.findMany
    ? await patientPaymentClient.findMany({
        where: {
          paidAt: {
            gte: safeStartDate,
            lte: safeEndDate,
          },
        },
        select: {
          amount: true,
          paidAt: true,
          method: true,
          note: true,
        },
        orderBy: { paidAt: "asc" },
      })
    : [];

  const groupedByDay = new Map<
    string,
    {
      key: string;
      date: Date;
      total: number;
      count: number;
      anticipo: number;
      paghero: number;
      due: number;
    }
  >();

  for (const entry of entries) {
    const dayKey = format(entry.occurredAt, "yyyy-MM-dd");
    const current = groupedByDay.get(dayKey) ?? {
      key: dayKey,
      date: entry.occurredAt,
      total: 0,
      count: 0,
      anticipo: 0,
      paghero: 0,
      due: 0,
    };

    current.total += Number(entry.amount);
    current.count += 1;

    groupedByDay.set(dayKey, current);
  }

  for (const payment of patientPayments) {
    const dayKey = format(payment.paidAt, "yyyy-MM-dd");
    const current = groupedByDay.get(dayKey) ?? {
      key: dayKey,
      date: payment.paidAt,
      total: 0,
      count: 0,
      anticipo: 0,
      paghero: 0,
      due: 0,
    };
    const amount = Number(payment.amount);
    const note = (payment.note ?? "").toLowerCase();
    const isAnticipo = note.includes("anticipo") || note.includes("acconto");

    if (payment.method === PatientPaymentMethod.PAY_LATER) {
      current.paghero += amount;
    } else if (isAnticipo) {
      current.anticipo += amount;
    }

    groupedByDay.set(dayKey, current);
  }

  const dailySummaries = Array.from(groupedByDay.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  for (const day of dailySummaries) {
    day.due = Math.max(0, day.total - day.anticipo - day.paghero);
  }
  const periodTotal = dailySummaries.reduce((sum, day) => sum + day.total, 0);
  const periodAnticipo = dailySummaries.reduce((sum, day) => sum + day.anticipo, 0);
  const periodPaghero = dailySummaries.reduce((sum, day) => sum + day.paghero, 0);
  const periodDue = dailySummaries.reduce((sum, day) => sum + day.due, 0);

  const periodLabel = `${format(safeStartDate, "d MMM yyyy", { locale: it })} - ${format(safeEndDate, "d MMM yyyy", { locale: it })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Report Mensile</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Riepilogo giornaliero delle entrate per il periodo selezionato.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            variant="primary"
            className="print:hidden"
          />
          <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-right dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Totale Periodo
              </p>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-900 dark:text-emerald-200">
                {formatCurrency(periodTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Anticipo
              </p>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-900 dark:text-amber-200">
                {formatCurrency(periodAnticipo)}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/50 px-4 py-3 text-right dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                Pagherò
              </p>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-900 dark:text-rose-200">
                {formatCurrency(periodPaghero)}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-right dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Dovuto
              </p>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatCurrency(periodDue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Seleziona periodo</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Visualizza i movimenti aggregati per data.
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Riepilogo giornaliero
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Periodo: {periodLabel}
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {dailySummaries.length} giorni con entrate
          </span>
        </div>

        {dailySummaries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            Nessuna entrata registrata per il periodo selezionato.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Giorno</th>
                  <th className="px-4 py-3 text-left">Movimenti</th>
                  <th className="px-4 py-3 text-right">Anticipo</th>
                  <th className="px-4 py-3 text-right">Pagherò</th>
                  <th className="px-4 py-3 text-right">Dovuto</th>
                  <th className="px-4 py-3 text-right">Totale incassato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {dailySummaries.map((day) => (
                  <tr key={day.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50 capitalize">
                      {format(day.date, "EEEE d MMMM", { locale: it })}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{day.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                      {formatCurrency(day.anticipo)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700 dark:text-rose-400">
                      {formatCurrency(day.paghero)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(day.due)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-800 dark:text-emerald-400">
                      {formatCurrency(day.total)}
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
