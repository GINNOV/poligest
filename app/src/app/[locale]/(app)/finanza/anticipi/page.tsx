import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createDoctorPayment, amendDoctorPayment, archiveDoctorPayment } from "../actions";
import { AmendDoctorPaymentButton } from "@/components/amend-doctor-payment-button";
import { ArchiveDoctorPaymentButton } from "@/components/archive-doctor-payment-button";

export const dynamic = "force-dynamic";

const ARCHIVE_PREFIX = "ARCHIVIATO:";
const DOCTOR_PAYMENT_PREFIX = "Pagamento medico";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type MediciSearchParams = {
  aq?: string;
  afrom?: string;
  ato?: string;
};

export default async function AnticipiPage({
  searchParams,
}: {
  searchParams?: Promise<MediciSearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const resolvedSearchParams = (await searchParams) ?? {};
  const today = toDateInputValue(new Date());
  const advanceQuery = (resolvedSearchParams.aq ?? "").trim();
  const advanceFromValue = (resolvedSearchParams.afrom ?? "").trim();
  const advanceToValue = (resolvedSearchParams.ato ?? "").trim();
  const hasAdvancedFilters =
    advanceQuery.length > 0 || advanceFromValue.length > 0 || advanceToValue.length > 0;
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
          contains: DOCTOR_PAYMENT_PREFIX,
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

  const doctorPayments = payments.map((entry) => {
    const description = entry.description || "";
    const methodMatch = description.match(/Metodo: ([^·]+)/);
    const methodLabel = methodMatch && methodMatch[1] ? methodMatch[1].trim() : null;
    
    return {
      id: entry.id,
      amount: entry.amount,
      occurredAt: entry.occurredAt,
      description: description
        .replace(`${DOCTOR_PAYMENT_PREFIX} · `, "")
        .replace(/Metodo: [^·]+ · /, "")
        .replace(/Metodo: [^·]+/, ""),
      methodLabel,
      doctorId: entry.doctorId,
      doctorName: entry.doctor?.fullName ?? "Medico",
    };
  });
  const paymentsByDoctor = doctorPayments.reduce<
    Array<{
      doctorId: string;
      doctorName: string;
      total: number;
      payments: typeof doctorPayments;
    }>
  >((groups, payment) => {
    const key = payment.doctorId ?? "unknown";
    const existingGroup = groups.find((group) => group.doctorId === key);

    if (existingGroup) {
      existingGroup.total += Number(payment.amount);
      existingGroup.payments.push(payment);
      return groups;
    }

    groups.push({
      doctorId: key,
      doctorName: payment.doctorName,
      total: Number(payment.amount),
      payments: [payment],
    });

    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <div>
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
          className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 lg:grid-cols-[1.5fr,1fr,1fr,1.5fr,2fr,auto] lg:items-end"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Medico</span>
            <select
              name="doctorId"
              required
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
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
            <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Importo</span>
            <input
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
              placeholder="0,00"
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Data</span>
            <input
              type="date"
              name="occurredAt"
              required
              defaultValue={today}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Metodo</span>
            <select
              name="paymentMethod"
              required
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
              defaultValue="ELECTRONIC"
            >
              <option value="ELECTRONIC">Elettronico</option>
              <option value="CASH">Contanti</option>
              <option value="BANK_TRANSFER">Bonifico</option>
              <option value="PAY_LATER">Pagherò</option>
              <option value="OTHER">Altro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nota</span>
            <input
              name="note"
              placeholder="Liquidazione aprile, anticipo, bonus..."
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Registra
          </button>
        </form>

        <details
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          open={hasAdvancedFilters}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-zinc-900 marker:content-none">
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Cerca e filtra
            </span>
            <span className="text-xs font-medium text-zinc-500 group-open:hidden">Mostra</span>
            <span className="hidden text-xs font-medium text-zinc-500 group-open:inline">Nascondi</span>
          </summary>

          <form className="mt-4 grid gap-3 text-sm lg:grid-cols-[2fr,1fr,2fr,auto] lg:items-end">
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
          <p className="mt-3 text-xs text-zinc-500">Le date sono opzionali. Se le lasci vuote, lo storico mostra tutti i pagamenti registrati.</p>
        </details>

        {doctorPayments.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
            Nessun pagamento medico registrato.
          </div>
        ) : (
          paymentsByDoctor.map((group) => (
            <details
              key={group.doctorId}
              className="group rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
              open
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:content-none">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-90"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m7 4 6 6-6 6" />
                    </svg>
                    <h2 className="truncate text-sm font-semibold text-zinc-900">{group.doctorName}</h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {group.payments.length} {group.payments.length === 1 ? "pagamento" : "pagamenti"}
                  </p>
                </div>
                <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {group.total.toFixed(2)} €
                </span>
              </summary>

              <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                {group.payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-zinc-200 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="text-xs text-zinc-600">
                          {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(payment.occurredAt)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                          {payment.description.includes("(CORRETTO)") && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              CORRETTO
                            </span>
                          )}
                          {payment.methodLabel && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {payment.methodLabel.toUpperCase()}
                            </span>
                          )}
                          {payment.description.replace("(CORRETTO) ", "") || "Liquidazione"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AmendDoctorPaymentButton 
                          payment={{ 
                            id: payment.id, 
                            amount: payment.amount.toString(), 
                            description: payment.description.replace("(CORRETTO) ", ""),
                            occurredAt: payment.occurredAt,
                            methodLabel: payment.methodLabel
                          }} 
                          action={amendDoctorPayment} 
                        />
                        <ArchiveDoctorPaymentButton
                          entryId={payment.id}
                          action={archiveDoctorPayment}
                        />
                        <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {Number(payment.amount).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
