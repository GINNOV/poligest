import Link from "next/link";
import { formatFailedDeliverySummary } from "@/lib/recalls/delivery-alerts";

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

export function RecallDeliveryFailureSummary({ count }: { readonly count: number }) {
  if (count <= 0) return null;

  return (
    <Link
      href="/richiami/programmati/non-inviati"
      className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm transition hover:border-rose-300 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:border-rose-800"
    >
      <span className="rounded-full bg-white p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
        <WarningIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{formatFailedDeliverySummary(count)}</span>
        <span className="mt-1 block text-sm text-rose-800 dark:text-rose-200">
          Cerca il paziente e completa telefono o email nella scheda.
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-rose-700 px-3 py-1 text-xs font-semibold text-white">
        Apri elenco
      </span>
    </Link>
  );
}
