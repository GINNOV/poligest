const FEATURES = [
  {
    title: "Gestisci appuntamenti",
    desc: "Prenota, sposta o cancella visite senza chiamare in studio.",
  },
  {
    title: "Documenti sempre disponibili",
    desc: "Scarica referti, piani di cura e ricevute quando ti servono.",
  },
  {
    title: "Promemoria e notifiche",
    desc: "Ricevi avvisi per i controlli e messaggi dallo studio.",
  },
  {
    title: "Massima privacy",
    desc: "Accesso cifrato e dati custoditi su infrastruttura sicura.",
  },
] as const;

export function HomeFeaturesAccordion() {
  return (
    <details className="group rounded-2xl border border-emerald-100 bg-emerald-50/40 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left transition hover:bg-emerald-50/80 sm:px-5">
        <span className="text-sm font-semibold text-emerald-900 sm:text-base">Cosa puoi fare nell&apos;area pazienti</span>
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition group-open:rotate-180"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </summary>

      <div className="space-y-3 border-t border-emerald-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-4 text-left shadow-[0_12px_40px_-24px_rgba(16,185,129,0.35)]"
            >
              <p className="text-sm font-semibold text-emerald-900">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-emerald-900 sm:py-4 sm:text-base">
          <p className="text-sm font-semibold sm:text-base">Serve aiuto?</p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-800 sm:text-base">
            <a
              href="mailto:studio.agovino.angrisano@gmail.com"
              className="font-semibold underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-900"
            >
              Scrivi
            </a>{" "}
            alla segreteria: ti invieremo un nuovo codice o ti guideremo nell&apos;accesso.
          </p>
        </div>
      </div>
    </details>
  );
}