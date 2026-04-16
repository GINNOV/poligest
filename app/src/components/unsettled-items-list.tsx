"use client";

import { usePaymentState } from "./payment-state-provider";

export function UnsettledItemsList() {
  const { items, openAccordion, setOpenAccordion } = usePaymentState();
  const unsettled = items.filter((i) => !i.saldato);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  return (
    <details
      open={openAccordion === "unsettled"}
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) {
          setOpenAccordion("unsettled");
        } else if (openAccordion === "unsettled") {
          setOpenAccordion(null);
        }
      }}
      className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600 dark:text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">2 - PRESTAZIONI NON ANCORA SALDATE</h2>
          </div>
        </div>
        <svg
          className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-4 p-6">
        {unsettled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Tutte le prestazioni risultano saldate o non è presente un preventivo.
          </div>
        ) : (
          <div className="space-y-3">
            {unsettled.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {item.serviceName}
                      {item.tooth ? (
                        <span className="ml-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 uppercase tracking-tighter">
                          Dente {item.tooth}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Quantità: {item.quantity}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "in_progress"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                        : item.status === "settled"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : item.status === "partial"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                        : item.altro > 0.009
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {item.status === "in_progress"
                      ? "Lavori in corso"
                      : item.status === "settled"
                      ? "Saldato"
                      : item.status === "partial"
                      ? "Parzialmente incassato"
                      : item.altro > 0.009
                      ? "Promesso (insolvente)"
                      : "Da incassare"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-[11px] font-semibold uppercase tracking-wider sm:grid-cols-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">Totale</span>
                    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-sm text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-emerald-700 dark:text-emerald-400">Incassato</span>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-1.5 font-mono text-sm text-emerald-900 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {formatCurrency(item.paid)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-zinc-600 dark:text-zinc-400">Pagherò</span>
                    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-sm text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {formatCurrency(item.paghero)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-rose-700 dark:text-rose-400">insolvente</span>
                    <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-2.5 py-1.5 font-mono text-sm text-rose-900 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                      {formatCurrency(item.altro)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-amber-700 dark:text-amber-400 font-bold">Residuo</span>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 font-mono text-sm font-bold text-amber-900 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                      {formatCurrency(item.remaining)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
