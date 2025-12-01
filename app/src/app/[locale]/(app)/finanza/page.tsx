import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

async function createFinanceEntry(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const type = (formData.get("type") as string) || "EXPENSE";
  const description = (formData.get("description") as string)?.trim();
  const amount = (formData.get("amount") as string)?.trim();
  const occurredAt = formData.get("occurredAt") as string;
  const doctorId = (formData.get("doctorId") as string) || null;
  if (!description || !amount || !occurredAt) {
    throw new Error("Dati mancanti");
  }

  await prisma.financeEntry.create({
    data: {
      type,
      description,
      amount,
      occurredAt: new Date(occurredAt),
      doctorId,
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
}

async function createCashAdvance(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const doctorId = formData.get("doctorId") as string;
  const amount = (formData.get("amount") as string)?.trim();
  const issuedAt = formData.get("issuedAt") as string;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!doctorId || !amount || !issuedAt) throw new Error("Dati mancanti");

  await prisma.cashAdvance.create({
    data: {
      doctorId,
      amount,
      issuedAt: new Date(issuedAt),
      note,
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
}

export default async function FinanzaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const [entries, advances, doctors] = await Promise.all([
    prisma.financeEntry.findMany({
      orderBy: { occurredAt: "desc" },
      include: { doctor: true },
      take: 20,
    }),
    prisma.cashAdvance.findMany({
      orderBy: { issuedAt: "desc" },
      include: { doctor: true },
      take: 20,
    }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
  ]);

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600">Finanza</p>
            <h1 className="text-2xl font-semibold text-zinc-900">Movimenti</h1>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            Saldo: {(totals.income - totals.expense).toFixed(2)} €
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="divide-y divide-zinc-100">
            {entries.length === 0 ? (
              <p className="px-4 py-4 text-sm text-zinc-600">Nessun movimento registrato.</p>
            ) : (
              entries.map((e) => {
                const isIncome = e.type.toUpperCase() === "INCOME";
                return (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900">{e.description}</span>
                      <span className="text-xs text-zinc-600">
                        {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(e.occurredAt)}{" "}
                        · {e.doctor?.fullName ?? "Generale"}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isIncome ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {Number(e.amount).toFixed(2)} €
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold text-zinc-900">Anticipi ai medici</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {advances.length === 0 ? (
              <p className="px-4 py-4 text-sm text-zinc-600">Nessun anticipo registrato.</p>
            ) : (
              advances.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900">{a.doctor?.fullName ?? "—"}</span>
                    <span className="text-xs text-zinc-600">
                      {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(a.issuedAt)} · {a.note ?? "Anticipo"}
                    </span>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {Number(a.amount).toFixed(2)} €
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo movimento</h2>
          <form action={createFinanceEntry} className="mt-3 space-y-3 text-sm">
            <select
              name="type"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue="EXPENSE"
            >
              <option value="INCOME">Entrata</option>
              <option value="EXPENSE">Uscita</option>
            </select>
            <input
              name="description"
              placeholder="Descrizione"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="amount"
              placeholder="Importo (€)"
              type="number"
              min="0"
              step="0.01"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="occurredAt"
              type="date"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <select
              name="doctorId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue=""
            >
              <option value="">Generale</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Salva movimento
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo anticipo</h2>
          <form action={createCashAdvance} className="mt-3 space-y-3 text-sm">
            <select
              name="doctorId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona medico
              </option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
            <input
              name="amount"
              placeholder="Importo (€)"
              type="number"
              min="0"
              step="0.01"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="issuedAt"
              type="date"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="note"
              placeholder="Nota"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
            >
              Registra anticipo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
