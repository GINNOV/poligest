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
    <div className="grid gap-4 md:grid-cols-6">
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">PRESTAZIONI</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">{formatCurrency(totals.total)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Incassato</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-500">{formatCurrency(totals.paid)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Acconto</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-500">{formatCurrency(totals.downpaymentCredit)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagherò</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-500">{formatCurrency(totals.paghero)}</p>
      </div>
      <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 px-4 py-3 shadow-sm dark:border-rose-900/30 dark:from-rose-950/20 dark:to-rose-900/20">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">totale insolvente</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-500">{formatCurrency(totals.altro)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Residuo</p>
        <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-500">{formatCurrency(totals.remaining)}</p>
      </div>
    </div>
  );
}
