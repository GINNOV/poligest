import Link from "next/link";
import {
  formatRecallDeliveryFailureDetail,
  type RecallDeliveryFailureAlert,
} from "@/lib/recalls/delivery-alerts";

type Props = {
  readonly alerts: readonly RecallDeliveryFailureAlert[];
  readonly dismissAction: (formData: FormData) => Promise<void>;
  readonly showPatientLink: boolean;
};

const attemptFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

export function RecallDeliveryFailureList({ alerts, dismissAction, showPatientLink }: Props) {
  if (alerts.length === 0) {
    return (
      <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">
        Nessun invio non riuscito con questi criteri.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{alert.patientName}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {formatRecallDeliveryFailureDetail(alert)}
            </p>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
              {alert.contactGap ?? "Controlla i dati di contatto nella scheda."}
            </p>
            {alert.lastContactAt ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Tentativo: {attemptFormat.format(alert.lastContactAt)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showPatientLink ? (
              <Link
                href={`/pazienti/${alert.patientId}?openContact=1#contact-info`}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-800"
              >
                Scheda paziente
              </Link>
            ) : null}
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
        </li>
      ))}
    </ul>
  );
}
