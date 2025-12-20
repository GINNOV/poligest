import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 px-6 py-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
          404 <span className="text-emerald-700">Pagina non trovata</span>
        </div>
        <div className="w-full rounded-3xl border border-emerald-100 bg-white/95 p-8 text-center shadow-lg shadow-emerald-100/60 backdrop-blur">
          <div className="mx-auto mb-6 flex justify-center">
            <Image
              src="/errors/404_it.png"
              alt="Pagina non trovata"
              width={960}
              height={520}
              className="h-auto max-w-full rounded-2xl shadow-inner"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Non troviamo questa pagina</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">
            Il contenuto potrebbe essere stato spostato o l&apos;indirizzo potrebbe essere errato. Torna alla home
            per proseguire la navigazione.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Torna alla home
            </Link>
            <Link
              href="/contatti"
              className="rounded-full border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
            >
              Contatta il centro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
