import Link from "next/link";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type FinanzaSearchParams = {
  q?: string;
  type?: string;
  from?: string;
  to?: string;
  aq?: string;
  atype?: string;
  afrom?: string;
  ato?: string;
};
async function archiveEntry(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const entryId = formData.get("entryId") as string;
  if (!entryId) return;

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId },
    select: { description: true },
  });

  if (!entry || entry.description.startsWith(ARCHIVE_PREFIX)) return;

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: { description: `${ARCHIVE_PREFIX} ${entry.description}` },
  });

  revalidatePath("/finanza");
}

async function archiveAdvance(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const advanceId = formData.get("advanceId") as string;
  if (!advanceId) return;

  const advance = await prisma.cashAdvance.findUnique({
    where: { id: advanceId },
    select: { note: true },
  });

  if (!advance || (advance.note ?? "").startsWith(ARCHIVE_PREFIX)) return;

  const nextNote = advance.note ? `${ARCHIVE_PREFIX} ${advance.note}` : ARCHIVE_PREFIX;
  await prisma.cashAdvance.update({
    where: { id: advanceId },
    data: { note: nextNote },
  });

  revalidatePath("/finanza");
}

export default async function FinanzaPage({
  searchParams,
}: {
  searchParams?: Promise<FinanzaSearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedSearchParams = (await searchParams) ?? {};
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const query = (resolvedSearchParams.q ?? "").trim();
  const typeFilter = (resolvedSearchParams.type ?? "all").toUpperCase();
  const fromValue = resolvedSearchParams.from ?? defaultFrom;
  const toValue = resolvedSearchParams.to ?? defaultTo;
  const fromDate = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const toDate = toValue ? new Date(`${toValue}T23:59:59.999`) : null;
  const advanceQuery = (resolvedSearchParams.aq ?? "").trim();
  const advanceTypeFilter = (resolvedSearchParams.atype ?? "all").toUpperCase();
  const advanceFromValue = resolvedSearchParams.afrom ?? defaultFrom;
  const advanceToValue = resolvedSearchParams.ato ?? defaultTo;
  const advanceFromDate = advanceFromValue
    ? new Date(`${advanceFromValue}T00:00:00`)
    : null;
  const advanceToDate = advanceToValue ? new Date(`${advanceToValue}T23:59:59.999`) : null;

  const [entries] = await Promise.all([
    prisma.financeEntry.findMany({
      where: {
        NOT: {
          description: { startsWith: ARCHIVE_PREFIX },
        },
        ...(typeFilter === "INCOME" || typeFilter === "EXPENSE"
          ? { type: typeFilter }
          : {}),
        ...(fromDate || toDate
          ? {
              occurredAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { description: { contains: query, mode: "insensitive" } },
                { doctor: { fullName: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { occurredAt: "desc" },
      include: { doctor: true },
      take: 200,
    }),
  ]);

  let advances: {
    id: string;
    patientId: string;
    amount: any;
    issuedAt: Date;
    note: string | null;
    patient: { firstName: string; lastName: string };
  }[] = [];
  try {
    advances = await prisma.cashAdvance.findMany({
      where: {
        NOT: {
          note: { startsWith: ARCHIVE_PREFIX },
        },
        ...(advanceFromDate || advanceToDate
          ? {
              issuedAt: {
                ...(advanceFromDate ? { gte: advanceFromDate } : {}),
                ...(advanceToDate ? { lte: advanceToDate } : {}),
              },
            }
          : {}),
        ...(advanceQuery
          ? {
              OR: [
                { note: { contains: advanceQuery, mode: "insensitive" } },
                { patient: { firstName: { contains: advanceQuery, mode: "insensitive" } } },
                { patient: { lastName: { contains: advanceQuery, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { issuedAt: "desc" },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: 20,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
      console.error("[finanza] cashAdvance column mismatch, showing advances as vuoto", err.meta);
      advances = [];
    } else {
      throw err;
    }
  }

  const totals = entries.reduce(
    (acc, e) => {
      if (e.type.toUpperCase() === "INCOME") {
        acc.income += Number(e.amount);
      } else {
        acc.expense += Number(e.amount);
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Movimenti</h1>
        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm font-mono uppercase tracking-wide">
          Saldo: {(totals.income - totals.expense).toFixed(2)} €
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/finanza/pagamenti"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/payer.png"
              alt="Pagamenti"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Pagamenti</h2>
        </Link>
        <Link
          href="/finanza/spese"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/spending.png"
              alt="Nuova spesa"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Nuova spesa</h2>
        </Link>
        <Link
          href="/finanza/anticipi"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/advance.png"
              alt="Nuovo anticipo"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Nuovo anticipo</h2>
        </Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:grid-cols-[2fr,1fr,2fr,auto] lg:items-end">
        <input type="hidden" name="aq" value={advanceQuery} />
        <input type="hidden" name="atype" value={advanceTypeFilter} />
        <input type="hidden" name="afrom" value={advanceFromValue} />
        <input type="hidden" name="ato" value={advanceToValue} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-zinc-500">Cerca</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Descrizione, medico o paziente"
            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-zinc-500">Tipo</span>
          <select
            name="type"
            defaultValue={typeFilter === "INCOME" || typeFilter === "EXPENSE" ? typeFilter : "all"}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">Tutti</option>
            <option value="INCOME">Entrata</option>
            <option value="EXPENSE">Uscita</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Dal</span>
            <input
              type="date"
              name="from"
              defaultValue={fromValue}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Al</span>
            <input
              type="date"
              name="to"
              defaultValue={toValue}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
        >
          Applica
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Movimenti</h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
            Nessun movimento registrato.
          </div>
        ) : (
          entries.map((e) => {
            const isIncome = e.type.toUpperCase() === "INCOME";
            return (
              <div key={e.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-900">{e.description}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>
                        {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(e.occurredAt)}
                      </span>
                      <span className="text-zinc-300">•</span>
                      <span>{e.doctor?.fullName ?? "Generale"}</span>
                      <span className="text-zinc-300">•</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isIncome
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {isIncome ? "Entrata" : "Uscita"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={archiveEntry}>
                      <input type="hidden" name="entryId" value={e.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                      >
                        Archivia
                      </button>
                    </form>
                    <span
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                        isIncome ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {Number(e.amount).toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-4 text-base font-semibold text-zinc-900">
              <span className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 13.5c0 1.2 1.4 2.2 3.5 2.2s3.5-1 3.5-2.2-1.4-2-3.5-2-3.5-.8-3.5-2 1.4-2.2 3.5-2.2 3.5 1 3.5 2.2" />
                  <path d="M12 6.5v11" />
                </svg>
                <span>Anticipi ai medici</span>
              </span>
            <svg
              className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <form className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:grid-cols-[2fr,1fr,2fr,auto] lg:items-end">
              <input type="hidden" name="q" value={query} />
              <input type="hidden" name="type" value={typeFilter} />
              <input type="hidden" name="from" value={fromValue} />
              <input type="hidden" name="to" value={toValue} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Cerca</span>
                <input
                  name="aq"
                  defaultValue={advanceQuery}
                  placeholder="Nota o paziente"
                  className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Tipo</span>
                <select
                  name="atype"
                  defaultValue={advanceTypeFilter === "INCOME" || advanceTypeFilter === "EXPENSE" ? advanceTypeFilter : "all"}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">Tutti</option>
                  <option value="INCOME">Entrata</option>
                  <option value="EXPENSE">Uscita</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Dal</span>
                  <input
                    type="date"
                    name="afrom"
                    defaultValue={advanceFromValue}
                    className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Al</span>
                  <input
                    type="date"
                    name="ato"
                    defaultValue={advanceToValue}
                    className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Applica
              </button>
            </form>

            {advances.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
                Nessun anticipo registrato.
              </div>
            ) : (
              advances.map((a) => (
                <div key={a.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/pazienti/${a.patientId}`}
                        className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {a.patient.lastName} {a.patient.firstName}
                      </Link>
                      <div className="text-xs text-zinc-600">
                        {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(a.issuedAt)} ·{" "}
                        {a.note ?? "Anticipo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={archiveAdvance}>
                        <input type="hidden" name="advanceId" value={a.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                        >
                          Archivia
                        </button>
                      </form>
                      <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        {Number(a.amount).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
