"use client";

import { usePaymentState } from "./payment-state-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";
import { PatientPaymentMethod } from "@prisma/client";

type PaymentHistoryProps = {
  historicalPayments: any[];
  paymentMethodLabels: Record<string, string>;
  displayTimeZone: string;
  archivePatientPaymentAction: (formData: FormData) => Promise<void>;
};

function getPaymentMethodIcon(method: PatientPaymentMethod) {
  switch (method) {
    case PatientPaymentMethod.CASH:
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
      );
    case PatientPaymentMethod.ELECTRONIC:
    case PatientPaymentMethod.BANK_TRANSFER:
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      );
    case PatientPaymentMethod.PAY_LATER:
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      );
  }
}

export function PaymentHistory({
  historicalPayments,
  paymentMethodLabels,
  displayTimeZone,
  archivePatientPaymentAction,
}: PaymentHistoryProps) {
  const router = useRouter();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  const handleArchive = async (formData: FormData) => {
    await archivePatientPaymentAction(formData);
    router.refresh();
  };

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden">
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
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 uppercase">4 - STORICO PAGAMENTI</h2>
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
        {historicalPayments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 uppercase">
            Nessun pagamento registrato per questo paziente.
          </div>
        ) : (
          <div className="space-y-3">
            {historicalPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">
                    {payment.quoteItem?.serviceName ?? "Pagamento paziente"}
                    {payment.quoteItem?.tooth ? (
                      <span className="ml-2 text-[10px] font-black text-blue-900 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/20 uppercase tracking-tighter">
                        Dente {payment.quoteItem.tooth}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span>
                        {formatDateInDisplayTimeZone(
                          payment.paidAt,
                          {
                            dateStyle: "medium",
                          },
                          displayTimeZone
                        )}
                      </span>
                    </div>
                    <span className="text-zinc-300 dark:text-zinc-700 font-normal opacity-50">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-400">{getPaymentMethodIcon(payment.method)}</span>
                      <span>{paymentMethodLabels[payment.method]}</span>
                    </div>
                    <span className="text-zinc-300 dark:text-zinc-700 font-normal opacity-50">•</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span>{payment.user?.name ?? payment.user?.email ?? "Operatore"}</span>
                    </div>
                  </div>
                  {payment.note ? <p className="text-sm text-zinc-700 dark:text-zinc-300 border-l-2 border-zinc-200 dark:border-zinc-800 pl-3 mt-2 italic">{payment.note}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <form action={handleArchive}>
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <Button
                      variant="outline"
                      size="xs"
                      type="submit"
                      className="rounded-full font-bold uppercase tracking-widest text-[10px]"
                      data-confirm="EMETTERE AMMENDA? Questa operazione stornerà l'importo di questa transazione e nella contabilita' sara' possibile fare cambiamenti. Si manterrà traccia del pagamento originale per scopi di audit."
                    >
                      AMMENDA
                    </Button>
                  </form>
                  <div className="min-w-[100px] text-right">
                    <div className="inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-sm font-bold text-emerald-900 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                      {formatCurrency(payment.amount)}
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
