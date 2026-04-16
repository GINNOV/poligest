"use client";

import { usePaymentState } from "./payment-state-provider";

export function PaymentsSummaryTiles() {
  const { totals } = usePaymentState();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">PRESTAZIONI</p>
        <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(totals.total)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Incassato</p>
        <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-500">{formatCurrency(totals.paid)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Residuo</p>
        <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-500">{formatCurrency(totals.remaining)}</p>
      </div>
    </div>
  );
}
