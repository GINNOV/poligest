import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { FinanceExpenseFields } from "@/components/finance-forms";
import { FormSubmitButton } from "@/components/form-submit-button";
import { recordExpense } from "../actions";

export const dynamic = "force-dynamic";

export default async function SpesePage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Nuova spesa</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action={recordExpense} className="space-y-3 text-sm">
          <FinanceExpenseFields suppliers={suppliers} products={products} />
          <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500">
            Registra spesa
          </FormSubmitButton>
        </form>
      </div>
    </div>
  );
}
