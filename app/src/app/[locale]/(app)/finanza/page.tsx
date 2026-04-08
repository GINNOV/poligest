import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export default async function FinanzaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Movimenti</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/finanza/pagamenti"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/payer.png"
              alt="Pagamenti pazienti"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti Pazienti</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Traccia appuntamento per appuntamento il flusso di cassa.
            Gestisci preventivi, incassi e residui del paziente.
          </p>
        </Link>
        <Link
          href="/finanza/spese"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/materiali_spese_ufficio.png"
              alt="Materiali e spese ufficio"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Materiali e Spese ufficio</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Registra acquisti, fornitori e costi operativi dello studio.
            Tieni ordinate le uscite per materiale e servizio.
          </p>
        </Link>
        <Link
          href="/finanza/anticipi"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/pagamenti_medici.png"
              alt="Pagamenti medici"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti medici</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Monitora anticipi e liquidazioni legate ai medici.
            Consulta i movimenti e archivia quelli chiusi.
          </p>
        </Link>
        <Link
          href="/finanza/report-giornaliero"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/accounting.png"
              alt="Report giornaliero"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Report Giornaliero</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Leggi le entrate di un singolo giorno della settimana corrente.
            Controlla i movimenti in cassa e il totale incassato.
          </p>
        </Link>
        <Link
          href="/finanza/report-mensile"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/report_mensile.png"
              alt="Report mensile"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Report Mensile</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Riepiloga il mese per giornata con le somme principali.
            Separa anticipo, pagherò, dovuto e totale incassato.
          </p>
        </Link>
        <Link
          href="/finanza/report-uscite"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/report_uscite.png"
              alt="Report uscite"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Report Uscite</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Analizza le uscite mensili per fornitore e tipologia.
            Verifica dove si concentrano materiali e spese ufficio.
          </p>
        </Link>
      </div>
    </div>
  );
}
