import { endOfMonth, format, isValid, parse, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { PatientPaymentMethod, Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type ReportMensilePageProps = {
  searchParams?: Promise<{ month?: string }>;
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
      type: "INCOME",
      occurredAt: {
        gte: monthStart,
        lte: monthEnd,
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
            gte: monthStart,
            lte: monthEnd,
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
  const monthTotal = dailySummaries.reduce((sum, day) => sum + day.total, 0);
  const monthAnticipo = dailySummaries.reduce((sum, day) => sum + day.anticipo, 0);
  const monthPaghero = dailySummaries.reduce((sum, day) => sum + day.paghero, 0);
  const monthDue = dailySummaries.reduce((sum, day) => sum + day.due, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-zinc-600">Finanza</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Report Mensile</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Riepilogo giornaliero delle entrate del mese selezionato.
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
              Totale del mese
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">{formatCurrency(monthTotal)}</p>
          </div>
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Anticipo / Pagherò / Due
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {formatCurrency(monthAnticipo)} / {formatCurrency(monthPaghero)} / {formatCurrency(monthDue)}
            </p>
          </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Seleziona il mese</h2>
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Riepilogo di {format(safeMonthDate, "MMMM yyyy", { locale: it })}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Ogni riga rappresenta il totale del report giornaliero per quella data.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {dailySummaries.length} giorni con entrate
          </span>
        </div>

        {dailySummaries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            Nessuna entrata registrata per il mese selezionato.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Giorno</th>
                  <th className="px-4 py-3 text-left">Movimenti</th>
                  <th className="px-4 py-3 text-right">Anticipo</th>
                  <th className="px-4 py-3 text-right">Pagherò</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Totale incassato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dailySummaries.map((day) => (
                  <tr key={day.key}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {format(day.date, "EEEE d MMMM", { locale: it })}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{day.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                      {formatCurrency(day.anticipo)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">
                      {formatCurrency(day.paghero)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-700">
                      {formatCurrency(day.due)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-800">
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
