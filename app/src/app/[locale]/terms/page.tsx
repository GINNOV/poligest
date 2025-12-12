"use client";

import Link from "next/link";

const points = [
  {
    title: "Oggetto del servizio",
    body: "Area riservata per la gestione di appuntamenti, comunicazioni e documentazione clinica offerta da Studio Agovino & Angrisano.",
  },
  {
    title: "Accesso e credenziali",
    body: "L'accesso è personale. Mantieni riservate le credenziali e avvisa immediatamente lo studio in caso di uso non autorizzato.",
  },
  {
    title: "Uso appropriato",
    body: "Non è consentito un uso improprio dell'area riservata (es. accesso non autorizzato, diffusione di contenuti illeciti o dannosi).",
  },
  {
    title: "Responsabilità",
    body: "Lo studio adotta misure tecniche e organizzative per la sicurezza. Non siamo responsabili per interruzioni dovute a manutenzione o cause di forza maggiore.",
  },
  {
    title: "Proprietà intellettuale",
    body: "Contenuti, marchi e materiali forniti nello spazio riservato restano di proprietà dello studio; è vietato l'uso non autorizzato.",
  },
  {
    title: "Privacy",
    body: "Il trattamento dei dati personali è descritto nell'Informativa Privacy. L'uso del servizio implica l'accettazione delle condizioni di trattamento.",
  },
  {
    title: "Durata e sospensione",
    body: "L'accesso può essere sospeso o revocato in caso di violazioni dei termini o esigenze di sicurezza.",
  },
  {
    title: "Modifiche",
    body: "Possiamo aggiornare questi termini; le modifiche saranno pubblicate su questa pagina. L'uso continuato vale come accettazione.",
  },
  {
    title: "Contatti",
    body: "Per domande sui termini o problemi di utilizzo, contatta la segreteria: info@sorrisosplendente.com.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Termini di servizio</p>
        <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Condizioni d&apos;uso dell&apos;area riservata</h1>
        <p className="text-sm text-zinc-600">
          Regole di utilizzo dello spazio pazienti fornito da Studio Agovino & Angrisano.
        </p>
      </div>

      <div className="mt-8 space-y-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        {points.map((section) => (
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
