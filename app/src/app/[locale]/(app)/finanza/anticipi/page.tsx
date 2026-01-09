import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createCashAdvance } from "../actions";

export const dynamic = "force-dynamic";

export default async function AnticipiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Nuovo anticipo</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action={createCashAdvance} className="space-y-3 text-sm">
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
  );
}
