import Link from "next/link";
import { eachDayOfInterval, endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type ReportGiornalieroPageProps = {
  searchParams?: Promise<{ day?: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default async function ReportGiornalieroPage({
  searchParams,
}: ReportGiornalieroPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedParams = (await searchParams) ?? {};
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const parsedDay =
    typeof resolvedParams.day === "string" ? new Date(`${resolvedParams.day}T12:00:00`) : null;
  const safeParsedDay =
    parsedDay &&
    !Number.isNaN(parsedDay.getTime()) &&
    isWithinInterval(parsedDay, { start: weekStart, end: weekEnd })
      ? parsedDay
      : today;

  const selectedDayKey = format(safeParsedDay, "yyyy-MM-dd");
  const selectedDayStart = new Date(`${selectedDayKey}T00:00:00`);
  const selectedDayEnd = new Date(`${selectedDayKey}T23:59:59.999`);

  const entries = await prisma.financeEntry.findMany({
    where: {
      type: "INCOME",
      occurredAt: {
        gte: selectedDayStart,
        lte: selectedDayEnd,
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

  const totalIncome = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-zinc-600">Finanza</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Report Giornaliero</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Flusso in entrata del giorno selezionato nella settimana corrente.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <PrintButton
            label="Stampa report"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
          />
          <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Totale incassato
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">{formatCurrency(totalIncome)}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">Seleziona il giorno</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {format(weekStart, "d MMM", { locale: it })} - {format(weekEnd, "d MMM", { locale: it })}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const isSelected = dayKey === selectedDayKey;

            return (
              <Link
                key={dayKey}
                href={`/finanza/report-giornaliero?day=${dayKey}`}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-zinc-200 bg-white hover:border-emerald-100 hover:bg-emerald-50/40"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {format(day, "EEE", { locale: it })}
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-900">
                  {format(day, "d MMM", { locale: it })}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Entrate del {format(safeParsedDay, "EEEE d MMMM yyyy", { locale: it })}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Ogni riga rappresenta un movimento in entrata registrato in finanza.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {entries.length} movimenti
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            Nessuna entrata registrata per questo giorno.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Ora</th>
                  <th className="px-4 py-3 text-left">Descrizione</th>
                  <th className="px-4 py-3 text-left">Medico</th>
                  <th className="px-4 py-3 text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-zinc-700">
                      {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(entry.occurredAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-900">{entry.description}</td>
                    <td className="px-4 py-3 text-zinc-700">{entry.doctor?.fullName ?? "Generale"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-800">
                      {formatCurrency(Number(entry.amount))}
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
