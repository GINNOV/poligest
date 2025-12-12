import Image from "next/image";
import Link from "next/link";
import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";

// Optional catch-all so /it/handler and /it/handler/* both work.
export default async function StackAuthHandlerPage(props: {
  params: Promise<{ stack?: string[] }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-10 top-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute right-6 bottom-6 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-5 rounded-2xl border border-emerald-100 bg-white/85 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Area Riservata Pazienti
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Studio Agovino & Angrisano
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Torna alla home
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.45)] backdrop-blur sm:p-8">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-200/45 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Accesso sicuro
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-900 sm:text-3xl">
                  Entra nel tuo spazio riservato
                </h1>
                <p className="mt-2 text-sm text-zinc-600">
                  Usa il tuo account (Google o credenziali) per prenotare visite, gestire documenti e comunicare con lo studio.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                <StackHandler
                  fullPage={false}
                  app={stackServerApp}
                  params={params}
                  searchParams={searchParams}
                />
              </div>

              <div className="rounded-xl bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">Consiglio:</p>
                <p className="mt-1 text-emerald-800">
                  Rimani su <span className="font-semibold">sorrisosplendente.com</span> durante l&apos;accesso. Se vedi errori, chiudi questa scheda e riprova da qui.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.45)] backdrop-blur sm:p-8">
            <h2 className="text-xl font-semibold text-zinc-900">
              Cosa puoi fare qui
            </h2>
            <ul className="space-y-3 text-sm text-zinc-700">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Prenota e gestisci gli appuntamenti con il tuo dentista.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Consulta documenti clinici e comunicazioni dello studio.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Ricevi notifiche e promemoria importanti.
              </li>
            </ul>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Assistenza</p>
              <p className="mt-1 text-emerald-800">
                Problemi con l&apos;accesso? Contatta la segreteria: ti aiuteremo subito.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
