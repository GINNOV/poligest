"use client";

import Link from "next/link";

const sections = [
  {
    title: "Chi siamo",
    body: "Studio Agovino & Angrisano (\"noi\") gestisce i servizi accessibili su sorrisosplendente.com. Proteggere la tua privacy è una nostra priorità.",
  },
  {
    title: "Dati raccolti",
    body: "Raccogliamo dati identificativi (nome, email, telefono), dati clinici necessari all'erogazione del servizio, e dati tecnici di accesso (log, cookie strettamente necessari).",
  },
  {
    title: "Finalità",
    body: "Gestione appuntamenti, erogazione delle prestazioni sanitarie, comunicazioni organizzative, adempimenti legali e di sicurezza.",
  },
  {
    title: "Base giuridica",
    body: "Consenso informato e obblighi contrattuali/legali. Puoi revocare il consenso in qualsiasi momento laddove previsto.",
  },
  {
    title: "Conservazione",
    body: "Conserviamo i dati per il tempo necessario alle finalità dichiarate o richiesto dalla normativa sanitaria e fiscale.",
  },
  {
    title: "Condivisione",
    body: "I dati sono accessibili solo a personale autorizzato e ai fornitori di servizi strettamente necessari (es. infrastruttura cloud) con adeguate misure di sicurezza.",
  },
  {
    title: "Diritti dell'interessato",
    body: "Puoi esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione e portabilità, ove applicabile, contattandoci ai recapiti dello studio.",
  },
  {
    title: "Cookie e tracciamento",
    body: "Utilizziamo cookie tecnici necessari al funzionamento del servizio e cookie di sicurezza. Non utilizziamo cookie di profilazione.",
  },
  {
    title: "Contatti",
    body: "Per richieste privacy, contatta la segreteria dello studio: info@sorrisosplendente.com o presso la sede legale dello studio.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Informativa Privacy</p>
        <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Tutela e trattamento dei dati personali</h1>
        <p className="text-sm text-zinc-600">
          Informazioni essenziali su come trattiamo i tuoi dati quando utilizzi i servizi di Studio Agovino & Angrisano.
        </p>
      </div>

      <div className="mt-8 space-y-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">{section.title}</h2>
            <p className="text-sm leading-6 text-zinc-700">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-800">
        <Link href="/" className="font-semibold hover:underline">
          Torna alla home
        </Link>
        <p className="text-emerald-700">Ultimo aggiornamento: {new Date().toISOString().slice(0, 10)}</p>
      </div>
    </main>
  );
}
