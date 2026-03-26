import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-emerald-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-14 text-center sm:px-6">
        <div className="inline-flex items-center justify-center self-center rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          404 <span className="text-emerald-700 dark:text-emerald-300">Pagina non trovata</span>
        </div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Non troviamo questa pagina</h1>
        <div className="flex justify-center">
          <Image
            src="/errors/404_it.png"
            alt="Pagina non trovata"
            width={360}
            height={240}
            className="h-auto w-72 sm:w-80"
            priority
          />
        </div>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Il contenuto potrebbe essere stato spostato o l&apos;indirizzo potrebbe essere errato. Torna alla home
          per proseguire la navigazione.
        </p>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Suggerimenti
          </p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Verifica l&apos;indirizzo o utilizza i pulsanti sotto per continuare.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Torna alla home
          </Link>
          <Link
            href="/contatti"
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
          >
            Contatta il centro
          </Link>
        </div>
      </main>
    </div>
  );
}
