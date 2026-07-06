import {
  formatRecallDeliveryFailureDetail,
  formatRecallDeliveryFailureTitle,
  type RecallDeliveryFailureAlert,
} from "@/lib/recalls/delivery-alerts";

type Props = {
  readonly alerts: readonly RecallDeliveryFailureAlert[];
  readonly dismissAction: (formData: FormData) => Promise<void>;
};

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

export function RecallDeliveryFailureAlerts({ alerts, dismissAction }: Props) {
  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Notifiche richiami non inviati">
      {alerts.map((alert) => (
        <article
          key={alert.id}
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-white p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              <WarningIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{formatRecallDeliveryFailureTitle(alert)}</p>
              <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
                {formatRecallDeliveryFailureDetail(alert)}
              </p>
              {alert.lastContactAt ? (
                <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
                  Tentativo: {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(alert.lastContactAt)}
                </p>
              ) : null}
            </div>
            <form action={dismissAction}>
              <input type="hidden" name="recallId" value={alert.id} />
              <button
                type="submit"
                className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
              >
                Chiudi
              </button>
            </form>
          </div>
        </article>
      ))}
    </section>
  );
}
