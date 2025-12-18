import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { FinanceExpenseFields, FinanceIncomeFields } from "@/components/finance-forms";
import { FormSubmitButton } from "@/components/form-submit-button";

async function recordIncome(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = (formData.get("patientId") as string) || "";
  const deliveredAt = formData.get("deliveredAt") as string;
  const deliveredItemId = (formData.get("deliveredItemId") as string) || "";
  const amount = (formData.get("amount") as string)?.trim();
  const isPartial = formData.get("partialPayment") === "1";

  if (!patientId || !deliveredAt || !deliveredItemId || !amount) throw new Error("Dati mancanti");

  const [patient, diaryEntry] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true } }),
    prisma.dentalRecord.findUnique({ where: { id: deliveredItemId }, select: { procedure: true, notes: true, performedAt: true, patientId: true } }),
  ]);

  if (!patient || !diaryEntry || diaryEntry.patientId !== patientId) throw new Error("Dati non validi");

  const descriptionParts = [
    `Pagamento paziente ${patient.lastName} ${patient.firstName}`,
    diaryEntry.procedure,
  ];
  if (diaryEntry.notes) descriptionParts.push(diaryEntry.notes);
  if (isPartial) descriptionParts.push("[Parziale]");

  await prisma.financeEntry.create({
    data: {
      type: "INCOME",
      description: descriptionParts.join(" · "),
      amount,
      occurredAt: new Date(deliveredAt),
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
}

async function recordExpense(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);

  const description = (formData.get("expenseDescription") as string)?.trim();
  const supplierId = (formData.get("supplierId") as string) || null;
  const productId = (formData.get("productId") as string) || null;
  const expenseKind = ((formData.get("expenseKind") as string) || "service").toLowerCase();
  const paymentType = ((formData.get("paymentType") as string) || "electronic").toLowerCase();
  const purchaseDate = formData.get("purchaseDate") as string;
  const amount = (formData.get("expenseAmount") as string)?.trim();
  const note = (formData.get("expenseNote") as string)?.trim();

  if (!description || !amount || !purchaseDate) throw new Error("Dati mancanti");

  const [supplier, product] = await Promise.all([
    supplierId ? prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }) : null,
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true } }) : null,
  ]);

  const details: string[] = [
    expenseKind === "material" ? "Spesa materiale" : "Spesa servizio",
    description,
  ];

  if (supplier?.name) details.push(`Fornitore: ${supplier.name}`);
  if (product?.name) details.push(`Materiale: ${product.name}`);
  details.push(`Pagamento: ${paymentType === "cash" ? "contanti" : "elettronico"}`);
  if (note) details.push(note);

  await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: details.join(" · "),
      amount,
      occurredAt: new Date(purchaseDate),
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
}

async function createCashAdvance(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = formData.get("patientId") as string;
  const amount = (formData.get("amount") as string)?.trim();
  const issuedAt = formData.get("issuedAt") as string;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!patientId || !amount || !issuedAt) throw new Error("Dati mancanti");

  await prisma.cashAdvance.create({
    data: {
      patientId,
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

  const [entries, doctors, patients, diaryEntries, suppliers, products] = await Promise.all([
    prisma.financeEntry.findMany({
      orderBy: { occurredAt: "desc" },
      include: { doctor: true },
      take: 20,
    }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
    prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.dentalRecord.findMany({
      orderBy: { performedAt: "desc" },
      include: { patient: true },
      take: 200,
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  let advances: { id: string; patientId: string; amount: any; issuedAt: Date; note: string | null }[] = [];
  try {
    advances = await prisma.cashAdvance.findMany({
      orderBy: { issuedAt: "desc" },
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

  const patientOptions = patients.map((p) => ({
    id: p.id,
    fullName: `${p.lastName} ${p.firstName}`,
  }));

  const patientNameById = new Map(patients.map((p) => [p.id, `${p.lastName} ${p.firstName}`]));

  const diaryOptions = diaryEntries.map((entry) => ({
    id: entry.id,
    patientId: entry.patientId,
    label: entry.procedure || "Procedura",
    performedAt: entry.performedAt.toISOString(),
  }));

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
                    <span className="font-semibold text-zinc-900">
                      {patientNameById.get(a.patientId) ?? "—"}
                    </span>
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
          <h2 className="text-sm font-semibold text-zinc-900">Pagamento cliente</h2>
          <form action={recordIncome} className="mt-3 space-y-3 text-sm">
            <FinanceIncomeFields patients={patientOptions} diaryOptions={diaryOptions} />
            <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
              Registra pagamento
            </FormSubmitButton>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuova spesa</h2>
          <form action={recordExpense} className="mt-3 space-y-3 text-sm">
            <FinanceExpenseFields suppliers={suppliers} products={products} />
            <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500">
              Registra spesa
            </FormSubmitButton>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo anticipo</h2>
          <form action={createCashAdvance} className="mt-3 space-y-3 text-sm">
            <select
              name="patientId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona paziente
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
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
            <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500">
              Registra anticipo
            </FormSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
