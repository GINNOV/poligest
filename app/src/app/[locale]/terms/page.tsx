"use client";

import Link from "next/link";
import { ReactNode } from "react";

const studio = {
  name: "Studio Associato Dottori Agovino e Angrisano",
  address: "Traversa I Farricella, 115",
  city: "80040 Striano (NA)",
  phone: "081 8654557",
  email: "studio.agovino.angrisano@gmail.com",
};

const introParagraphs = [
  "La presente pagina disciplina i Termini e Condizioni (di seguito \"Termini\") relativi all'utilizzo del sito web dello Studio Associato Dottori Agovino e Angrisano (di seguito \"Studio\" o \"noi\") e all'erogazione dei servizi odontoiatrici offerti.",
  "Accedendo al sito web o prenotando/utilizzando i nostri servizi, l'utente (di seguito \"Paziente\" o \"Utente\") accetta integralmente i presenti Termini. Qualora non si accetti, si prega di non utilizzare il sito o i servizi.",
];

const sections: { title: string; content: ReactNode }[] = [
  {
    title: "1. Oggetto",
    content: (
      <>
        <p className="text-sm leading-6 text-zinc-700">Lo Studio eroga prestazioni odontoiatriche professionali, tra cui:</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>prevenzione</li>
          <li>igiene orale</li>
          <li>conservativa</li>
          <li>endodonzia</li>
          <li>protesi</li>
          <li>implantologia</li>
          <li>estetica dentale</li>
          <li>ortodonzia</li>
          <li>chirurgia orale</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Qualora applicabili. I servizi sono prestati dai Dottori Gaetano Agovino e Alessandro Angrisano, iscritti
          all'Albo dei Medici Chirurghi e Odontoiatri.
        </p>
      </>
    ),
  },
  {
    title: "2. Prenotazione degli appuntamenti",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Gli appuntamenti possono essere prenotati telefonicamente, via email o attraverso eventuali moduli online sul sito.</li>
        <li>Lo Studio si riserva il diritto di confermare o modificare l'appuntamento in base alla disponibilità.</li>
        <li>Il Paziente è tenuto a presentarsi puntuale. In caso di ritardo superiore a 15 minuti, lo Studio potrà riprogrammare l'appuntamento.</li>
        <li>
          La cancellazione o modifica di un appuntamento deve avvenire con almeno 24 ore di preavviso. In caso di mancata
          disdetta o cancellazione tardiva, lo Studio si riserva il diritto di addebitare una penale pari al costo della
          prestazione prenotata.
        </li>
      </ul>
    ),
  },
  {
    title: "3. Erogazione dei servizi",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Le prestazioni sono erogate nel pieno rispetto delle norme deontologiche e delle linee guida professionali.</li>
        <li>
          Prima di ogni trattamento, il Paziente riceverà un piano di cura dettagliato con descrizione delle terapie
          proposte, costi e alternative possibili.
        </li>
        <li>Il Paziente è tenuto a fornire informazioni complete e veritiere sullo stato di salute e sull'anamnesi medica.</li>
        <li>Il consenso informato è obbligatorio per ogni trattamento invasivo.</li>
      </ul>
    ),
  },
  {
    title: "4. Pagamenti",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>I preventivi sono validi per il periodo indicato; successivamente potranno subire variazioni.</li>
        <li>Il pagamento delle prestazioni avviene di norma al termine della seduta o secondo il piano rateale concordato.</li>
        <li>Sono accettati pagamenti in contanti (nei limiti di legge), POS, bonifico bancario.</li>
        <li>In caso di ritardato pagamento, potranno essere applicati interessi di mora.</li>
        <li>Le fatture sono detraibili fiscalmente come spese mediche.</li>
      </ul>
    ),
  },
  {
    title: "5. Responsabilità",
    content: (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>
          Lo Studio opera con la massima diligenza professionale, ma non può garantire risultati specifici, in quanto i
          trattamenti odontoiatrici dipendono anche da fattori biologici individuali e dalla collaborazione del Paziente
          (igiene orale, follow-up, ecc.).
        </li>
        <li>Il Paziente è responsabile del rispetto delle indicazioni post-trattamento.</li>
        <li>
          Lo Studio non è responsabile per danni derivanti da informazioni incomplete fornite dal Paziente o da mancata
          osservanza delle prescrizioni.
        </li>
        <li>
          Lo Studio declina ogni responsabilità per l'uso del sito web da parte dell'Utente, inclusi eventuali danni
          derivanti da virus o malfunzionamenti.
        </li>
      </ul>
    ),
  },
  {
    title: "6. Diritti di proprietà intellettuale",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Tutti i contenuti del sito web (testi, immagini, loghi) sono di proprietà dello Studio o dei legittimi titolari e
        sono protetti dalle norme sul diritto d'autore. È vietata la riproduzione non autorizzata.
      </p>
    ),
  },
  {
    title: "7. Protezione dei dati personali",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Il trattamento dei dati personali avviene nel rispetto del Regolamento UE 2016/679 (GDPR). Si invita a consultare
        l'{" "}
        <Link href="/privacy" className="font-semibold text-emerald-700 hover:underline">
          Informativa Privacy
        </Link>{" "}
        per maggiori dettagli.
      </p>
    ),
  },
  {
    title: "8. Modifiche ai Termini",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Lo Studio si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno
        pubblicate su questa pagina con indicazione della data di aggiornamento. L'uso continuato del sito o dei servizi
        costituisce accettazione delle modifiche.
      </p>
    ),
  },
  {
    title: "9. Legge applicabile e foro competente",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia derivante dall'applicazione dei
        Termini sarà competente in via esclusiva il Foro di Napoli.
      </p>
    ),
  },
  {
    title: "10. Contatti",
    content: (
      <p className="text-sm leading-6 text-zinc-700">
        Per qualsiasi informazione o chiarimento relativi ai presenti Termini, è possibile contattare lo Studio ai
        recapiti indicati in testa alla pagina.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Termini e Condizioni</p>
        <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Condizioni d&apos;uso e servizi dello Studio</h1>
        <p className="text-sm text-zinc-600">Regole per l&apos;uso del sito e per l&apos;erogazione dei servizi odontoiatrici.</p>
      </div>

      <div className="mt-6 grid gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-8">
        <div className="space-y-1 text-sm leading-6 text-zinc-700">
          <p className="text-base font-semibold text-zinc-900">{studio.name}</p>
          <p>{studio.address}</p>
          <p>{studio.city}</p>
          <p>Telefono: {studio.phone}</p>
          <p>Email: {studio.email}</p>
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
        Grazie per la fiducia accordataci.
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
