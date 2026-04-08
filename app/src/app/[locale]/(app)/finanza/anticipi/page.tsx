import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createDoctorPayment } from "../actions";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";
const DOCTOR_PAYMENT_PREFIX = "Pagamento medico";

type MediciSearchParams = {
  aq?: string;
  afrom?: string;
  ato?: string;
};

async function archiveDoctorPayment(formData: FormData) {
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
  const advanceFromValue = resolvedSearchParams.afrom ?? defaultFrom;
  const advanceToValue = resolvedSearchParams.ato ?? defaultTo;
  const advanceFromDate = advanceFromValue
    ? new Date(`${advanceFromValue}T00:00:00`)
    : null;
  const advanceToDate = advanceToValue ? new Date(`${advanceToValue}T23:59:59.999`) : null;
  const [doctors, payments] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, specialty: true },
    }),
    prisma.financeEntry.findMany({
      where: {
        type: "EXPENSE",
        doctorId: { not: null },
        description: {
          startsWith: DOCTOR_PAYMENT_PREFIX,
        },
        NOT: {
          description: { startsWith: `${ARCHIVE_PREFIX} ${DOCTOR_PAYMENT_PREFIX}` },
        },
        ...(advanceFromDate || advanceToDate
          ? {
              occurredAt: {
                ...(advanceFromDate ? { gte: advanceFromDate } : {}),
                ...(advanceToDate ? { lte: advanceToDate } : {}),
              },
            }
          : {}),
        ...(advanceQuery
          ? {
              OR: [
                { description: { contains: advanceQuery, mode: "insensitive" } },
                { doctor: { fullName: { contains: advanceQuery, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { occurredAt: "desc" },
      include: {
        doctor: { select: { fullName: true } },
      },
      take: 50,
    }),
  ]);

  const doctorPayments = payments.map((entry) => ({
    id: entry.id,
    amount: entry.amount,
    occurredAt: entry.occurredAt,
    description: entry.description.replace(`${DOCTOR_PAYMENT_PREFIX} · `, ""),
    doctorId: entry.doctorId,
    doctorName: entry.doctor?.fullName ?? "Medico",
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti medici</h1>
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
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Registra pagamento</h2>
              <p className="mt-1 text-sm text-zinc-600">Inserisci una liquidazione o un anticipo legato a un medico.</p>
            </div>
          </div>
        </div>

        <form
          action={createDoctorPayment}
          className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:grid-cols-[1.5fr,1fr,1fr,2fr,auto] lg:items-end"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Medico</span>
            <select
              name="doctorId"
              required
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona medico
              </option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Importo</span>
            <input
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
              placeholder="0,00"
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Data</span>
            <input
              type="date"
              name="occurredAt"
              required
              defaultValue={defaultTo}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Nota</span>
            <input
              name="note"
              placeholder="Liquidazione aprile, anticipo, bonus..."
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
          >
            Registra
          </button>
        </form>

        <form className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:grid-cols-[2fr,1fr,2fr,auto] lg:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Cerca</span>
            <input
              name="aq"
              defaultValue={advanceQuery}
              placeholder="Nota o medico"
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
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

        {doctorPayments.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
            Nessun pagamento medico registrato.
          </div>
        ) : (
          doctorPayments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-zinc-900">{payment.doctorName}</div>
                  <div className="text-xs text-zinc-600">
                    {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(payment.occurredAt)} ·{" "}
                    {payment.description || "Liquidazione"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={archiveDoctorPayment}>
                    <input type="hidden" name="entryId" value={payment.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      Archivia
                    </button>
                  </form>
                  <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {Number(payment.amount).toFixed(2)} €
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
