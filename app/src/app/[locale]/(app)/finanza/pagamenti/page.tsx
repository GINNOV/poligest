import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { FinanceIncomeFields } from "@/components/finance-forms";
import { FormSubmitButton } from "@/components/form-submit-button";
import { recordIncome } from "../actions";

export const dynamic = "force-dynamic";

export default async function PagamentiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const [patients, diaryEntries] = await Promise.all([
    prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.dentalRecord.findMany({
      orderBy: { performedAt: "desc" },
      include: { patient: true },
      take: 200,
    }),
  ]);

  const patientOptions = patients.map((p) => ({
    id: p.id,
    fullName: `${p.lastName} ${p.firstName}`,
  }));

  const diaryOptions = diaryEntries.map((entry) => ({
    id: entry.id,
    patientId: entry.patientId,
    label: entry.procedure || "Procedura",
    performedAt: entry.performedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Pagamenti</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action={recordIncome} className="space-y-3 text-sm">
          <FinanceIncomeFields patients={patientOptions} diaryOptions={diaryOptions} />
          <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
            Registra pagamento
          </FormSubmitButton>
        </form>
      </div>
    </div>
  );
}
