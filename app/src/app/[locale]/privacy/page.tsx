"use client";

import Link from "next/link";
import { ReactNode } from "react";

const studio = {
  name: "Studio Dentistico Agovino & Angrisano",
  address: "Via Farricella, 115, Striano (NA)",
  partitaIva: "07234911217",
  email: "studio.agovino.angrisano@gmail.com",
  phone: "0818654557",
};

const introParagraphs = [
  "La presente informativa è resa ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 (Codice Privacy, come modificato dal D.Lgs. 101/2018) da Studio Dentistico Agovino & Angrisano (di seguito \"Studio\" o \"Titolare\"), in qualità di Titolare del trattamento dei dati personali.",
  "Lo Studio attribuisce la massima importanza alla protezione dei dati personali dei propri pazienti, visitatori del sito web e di chiunque interagisca con i suoi servizi.",
];

const sections: { title: string; content: ReactNode }[] = [
  {
    title: "1. Titolare del trattamento",
    content: (
      <>
        <p className="text-sm leading-6 text-zinc-700">
          Il Titolare del trattamento è {studio.name}, con sede legale in {studio.address}.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700">
          <li>Email: {studio.email}</li>
          <li>Telefono: {studio.phone}</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. Responsabile della protezione dei dati (DPO)",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Lo Studio non è obbligato a nominare un Responsabile della Protezione dei Dati (DPO) ai sensi dell'art. 37 del
        GDPR. Per qualsiasi questione relativa al trattamento dei dati personali è possibile contattare direttamente il
        Titolare ai recapiti sopra indicati.
      </p>
    ),
  },
  {
    title: "3. Tipologie di dati personali trattati",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>
          <span className="font-semibold">Dati identificativi e di contatto</span>: nome, cognome, data di nascita,
          indirizzo, numero di telefono, indirizzo email.
        </li>
        <li>
          <span className="font-semibold">Dati sanitari</span>: anamnesi medica, referti, radiografie, diagnosi, terapie
          effettuate e pianificate, nonché ogni altro dato relativo allo stato di salute necessario per l'erogazione
          delle cure odontoiatriche.
        </li>
        <li>
          <span className="font-semibold">Dati di pagamento</span>: informazioni relative a pagamenti (es. coordinate
          bancarie, solo se fornite volontariamente).
        </li>
        <li>
          <span className="font-semibold">Dati di navigazione</span> (solo tramite il sito web): indirizzo IP, tipo di
          browser, pagine visitate, tempo di permanenza (attraverso cookie o tecnologie simili – vedi sezione Cookie).
        </li>
      </ul>
    ),
  },
  {
    title: "4. Finalità del trattamento",
    content: (
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Erogazione delle prestazioni sanitarie odontoiatriche (diagnosi, cura, prevenzione).</li>
        <li>Gestione degli appuntamenti e delle comunicazioni con il paziente.</li>
        <li>Adempimento di obblighi legali (es. tenuta delle cartelle cliniche, fatturazione, comunicazioni all'Agenzia delle Entrate).</li>
        <li>Invio di comunicazioni relative ai servizi dello Studio (es. promemoria appuntamenti, aggiornamenti su terapie).</li>
        <li>Eventuale invio di comunicazioni informative e promozionali (solo con consenso esplicito).</li>
        <li>Miglioramento del sito web e analisi statistica anonima della navigazione.</li>
      </ol>
    ),
  },
  {
    title: "5. Base giuridica del trattamento",
    content: (
      <>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>
            <span className="font-semibold">Esecuzione del contratto</span> e misure precontrattuali (art. 6, par. 1, lett. b GDPR) per l'erogazione delle cure e la gestione degli appuntamenti.
          </li>
          <li>
            <span className="font-semibold">Obbligo legale</span> (art. 6, par. 1, lett. c GDPR) per la tenuta della documentazione sanitaria e gli adempimenti fiscali.
          </li>
          <li>
            <span className="font-semibold">Interesse legittimo del Titolare</span> (art. 6, par. 1, lett. f GDPR) per comunicazioni di servizio e sicurezza del sito.
          </li>
          <li>
            <span className="font-semibold">Consenso dell'interessato</span> (art. 6, par. 1, lett. a GDPR e art. 9, par. 2, lett. a GDPR) per trattamenti di dati particolari (sanitari) non strettamente necessari alla cura o per comunicazioni promozionali.
          </li>
          <li>
            <span className="font-semibold">Protezione degli interessi vitali</span> (in casi eccezionali).
          </li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Il trattamento dei dati sanitari è inoltre legittimato dall'art. 9, par. 2, lett. h GDPR (finalità di medicina
          preventiva, diagnosi, assistenza o terapia sanitaria).
        </p>
      </>
    ),
  },
  {
    title: "6. Modalità di trattamento",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Il trattamento avviene con strumenti manuali, informatici e telematici, con logiche strettamente correlate alle
        finalità indicate e comunque in modo da garantire la sicurezza e la riservatezza dei dati.
      </p>
    ),
  },
  {
    title: "7. Conferimento dei dati",
    content: (
      <>
        <p className="text-sm leading-6 text-zinc-700">
          Il conferimento dei dati identificativi e sanitari è obbligatorio per l'erogazione delle cure odontoiatriche.
          Il rifiuto comporterebbe l'impossibilità di prestare i servizi richiesti.
        </p>
        <p className="text-sm leading-6 text-zinc-700">Il conferimento dei dati per finalità promozionali è facoltativo.</p>
      </>
    ),
  },
  {
    title: "8. Destinatari dei dati",
    content: (
      <>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>Personale dello Studio autorizzato al trattamento.</li>
          <li>Fornitori esterni (es. laboratori odontotecnici, consulenti contabili, provider IT) nominati Responsabili del trattamento.</li>
          <li>Autorità sanitarie o Enti pubblici in caso di obbligo di legge.</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-zinc-700">I dati non sono trasferiti al di fuori dell'Unione Europea.</p>
      </>
    ),
  },
  {
    title: "9. Periodo di conservazione",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Dati sanitari: 10 anni dalla cessazione del rapporto terapeutico (o più a lungo se richiesto dalla legge).</li>
        <li>Dati contabili: 10 anni (obblighi fiscali).</li>
        <li>Dati di navigazione: massimo 12 mesi.</li>
        <li>Dati per finalità promozionali: fino alla revoca del consenso.</li>
      </ul>
    ),
  },
  {
    title: "10. Diritti dell'interessato",
    content: (
      <>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>Accedere ai propri dati.</li>
          <li>Richiederne la rettifica o l'aggiornamento.</li>
          <li>Richiederne la cancellazione (“diritto all'oblio”) nei casi previsti.</li>
          <li>Limitarne il trattamento.</li>
          <li>Opporsi al trattamento.</li>
          <li>Ricevere i dati in formato strutturato (portabilità).</li>
          <li>Revocare il consenso in qualsiasi momento senza pregiudicare la liceità del trattamento precedente.</li>
          <li>Proporre reclamo all'Autorità Garante per la protezione dei dati personali (www.garanteprivacy.it).</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Per esercitare i diritti è possibile contattare il Titolare ai recapiti indicati.
        </p>
      </>
    ),
  },
  {
    title: "11. Cookie e tecnologie simili",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Il sito web dello Studio utilizza cookie tecnici necessari per il funzionamento del sito e cookie analitici
        anonimizzati. Per maggiori dettagli consultare l'Informativa Cookie disponibile sul sito.
      </p>
    ),
  },
  {
    title: "12. Modifiche alla presente informativa",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Il Titolare si riserva di modificare la presente informativa. La versione aggiornata sarà pubblicata su questa
        pagina con indicazione della data di ultimo aggiornamento.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Informativa Privacy</p>
        <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Tutela e trattamento dei dati personali</h1>
        <p className="text-sm text-zinc-600">Informativa completa sul trattamento dei dati da parte dello Studio.</p>
      </div>

      <div className="mt-6 grid gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-8">
        <div className="space-y-1 text-sm leading-6 text-zinc-700">
          <p className="text-base font-semibold text-zinc-900">{studio.name}</p>
          <p>{studio.address}</p>
          <p>Partita IVA: {studio.partitaIva}</p>
          <p>Email: {studio.email}</p>
          <p>Telefono: {studio.phone}</p>
        </div>
        <div className="space-y-3 text-sm leading-6 text-zinc-700">
          {introParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">{section.title}</h2>
            {section.content}
          </section>
        ))}
      </div>

      <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
        Per qualsiasi chiarimento è possibile contattare lo Studio ai recapiti sopra indicati.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-800">
        <Link href="/" className="font-semibold hover:underline">
          Torna alla home
        </Link>
        <p className="text-emerald-700">Ultimo aggiornamento: 14 dicembre 2025</p>
      </div>
    </main>
  );
}
