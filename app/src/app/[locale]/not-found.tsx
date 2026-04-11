import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-emerald-50 text-zinc-900">
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-14 text-center sm:px-6">
        <div className="inline-flex items-center justify-center self-center rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
          404 <span className="text-emerald-700">Pagina non trovata</span>
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
        <p className="text-sm leading-6 text-zinc-600">
          Il contenuto potrebbe essere stato spostato o l&apos;indirizzo potrebbe essere errato. Torna alla home
          per proseguire la navigazione.
        </p>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Suggerimenti
          </p>
          <p className="mt-2 text-sm text-zinc-700">
            Verifica l&apos;indirizzo o utilizza i pulsanti sotto per continuare.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <Button asChild variant="primary" className="rounded-full"><Link href="/">Torna alla home</Link></Button>
          <Button asChild variant="outline" className="rounded-full border-zinc-200"><Link href="/contatti">Contatta il centro</Link></Button>
        </div>
      </main>
    </div>
  );
}
