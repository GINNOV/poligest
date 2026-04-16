"use client";

import { usePaymentState } from "./payment-state-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

type PaymentHistoryProps = {
  historicalPayments: any[];
  paymentMethodLabels: Record<string, string>;
  displayTimeZone: string;
  archivePatientPaymentAction: (formData: FormData) => Promise<void>;
};

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
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">4 - STORICO PAGAMENTI</h2>
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
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Nessun pagamento registrato per questo paziente.
          </div>
        ) : (
          <div className="space-y-3">
            {historicalPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {payment.quoteItem?.serviceName ?? "Pagamento paziente"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>
                      {formatDateInDisplayTimeZone(
                        payment.paidAt,
                        {
                          dateStyle: "medium",
                        },
                        displayTimeZone
                      )}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span>{paymentMethodLabels[payment.method]}</span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span>{payment.user?.name ?? payment.user?.email ?? "Operatore"}</span>
                  </div>
                  {payment.note ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{payment.note}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <form action={handleArchive}>
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <Button
                      variant="outline"
                      size="xs"
                      type="submit"
                      className="rounded-full"
                      data-confirm="Archiviare questo pagamento registrato?"
                    >
                      Archivia
                    </Button>
                  </form>
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {formatCurrency(Number(payment.amount.toString()))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
