import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

type MediciSearchParams = {
  aq?: string;
  atype?: string;
  afrom?: string;
  ato?: string;
};

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
  revalidatePath("/finanza/anticipi");
}

export default async function AnticipiPage({
  searchParams,
}: {
  searchParams?: Promise<MediciSearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedSearchParams = (await searchParams) ?? {};
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const advanceQuery = (resolvedSearchParams.aq ?? "").trim();
  const advanceTypeFilter = (resolvedSearchParams.atype ?? "all").toUpperCase();
  const advanceFromValue = resolvedSearchParams.afrom ?? defaultFrom;
  const advanceToValue = resolvedSearchParams.ato ?? defaultTo;
  const advanceFromDate = advanceFromValue
    ? new Date(`${advanceFromValue}T00:00:00`)
    : null;
  const advanceToDate = advanceToValue ? new Date(`${advanceToValue}T23:59:59.999`) : null;

  let advances: {
    id: string;
    patientId: string;
    amount: Prisma.Decimal;
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Pagamenti medici</h1>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
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
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Anticipi ai medici</h2>
            </div>
          </div>
        </div>

        <form className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:grid-cols-[2fr,1fr,2fr,auto] lg:items-end">
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
              defaultValue={
                advanceTypeFilter === "INCOME" || advanceTypeFilter === "EXPENSE"
                  ? advanceTypeFilter
                  : "all"
              }
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
    </div>
  );
}
