import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

const TILES = [
  {
    href: "/finanza/pagamenti",
    src: "/tiles/payer.png",
    alt: "Pagamenti pazienti",
    title: "Pagamenti Pazienti",
    description: "Traccia appuntamento per appuntamento il flusso di cassa. Gestisci preventivi, incassi e residui del paziente.",
  },
  {
    href: "/finanza/spese",
    src: "/tiles/materiali_spese_ufficio.png",
    alt: "Materiali e spese ufficio",
    title: "Materiali e Spese ufficio",
    description: "Registra acquisti, fornitori e costi operativi dello studio. Tieni ordinate le uscite per materiale e servizio.",
  },
  {
    href: "/finanza/anticipi",
    src: "/tiles/pagamenti_medici.png",
    alt: "Pagamenti medici",
    title: "Pagamenti medici",
    description: "Monitora anticipi e liquidazioni legate ai medici. Consulta i movimenti e archivia quelli chiusi.",
  },
  {
    href: "/finanza/report-giornaliero",
    src: "/tiles/accounting.png",
    alt: "Report giornaliero",
    title: "Report Giornaliero",
    description: "Leggi le entrate di un singolo giorno della settimana corrente. Controlla i movimenti in cassa e il totale incassato.",
  },
  {
    href: "/finanza/report-mensile",
    src: "/tiles/report_mensile.png",
    alt: "Report mensile",
    title: "Report Mensile",
    description: "Riepiloga il mese per giornata con le somme principali. Separa anticipo, pagherò, dovuto e totale incassato.",
  },
  {
    href: "/finanza/report-uscite",
    src: "/tiles/report_uscite.png",
    alt: "Report uscite",
    title: "Report Uscite",
    description: "Analizza le uscite mensili per fornitore e tipologia. Verifica dove si concentrano materiali e spese ufficio.",
  },
  {
    href: "/finanza/report-medici",
    src: "/tiles/report_medici.png",
    alt: "Report medici",
    title: "Report Medici",
    description: "Visualizza il riepilogo mensile dei compensi e dei pagamenti per ogni medico. Monitora le spettanze e le liquidazioni effettuate.",
  },
];

export default async function FinanzaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Movimenti</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <Image
                src={tile.src}
                alt={tile.alt}
                width={640}
                height={360}
                className="h-44 w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">{tile.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {tile.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
