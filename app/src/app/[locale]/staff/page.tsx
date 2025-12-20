import Link from "next/link";
import { stackServerApp } from "@/lib/stack-app";
import Image from "next/image";

function withParam(url: string, key: string, value: string) {
  const hasQuery = url.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export default async function StaffAccessPage() {
  const baseSignIn = stackServerApp.urls.signIn ?? "/handler/sign-in";
  const staffSignInUrl = withParam(baseSignIn, "audience", "staff");

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-14 text-slate-50">
      <div className="pointer-events-none absolute left-10 top-14 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-14 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-5 py-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                fill
                className="object-contain p-1"
                sizes="40px"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Accesso staff</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                Studio Agovino & Angrisano
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 hover:text-cyan-100"
          >
            Torna all&apos;area pazienti
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.8)] backdrop-blur">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="relative space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Accesso riservato</p>
                <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Portale staff</h1>
                <p className="mt-2 text-sm text-slate-200">
                  Segreteria, medici e manager accedono qui per agenda, pazienti, richiamo e finanza. Autenticazione
                  sicura tramite Stack.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 shadow-lg sm:p-5">
                <Link
                  href={staffSignInUrl}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Accedi all&apos;area staff
                </Link>
                <p className="mt-2 text-xs text-slate-300">Usa Google o il codice email per autenticarti.</p>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                <p className="font-semibold text-cyan-200">Assistenza IT</p>
                <p className="mt-1">
                  Se non riesci a entrare, contatta un amministratore o apri un ticket interno. Non utilizzare l&apos;area
                  pazienti.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_28px_80px_-36px_rgba(8,47,73,0.7)] backdrop-blur">
            <h2 className="text-xl font-semibold text-white">Cosa include l&apos;area staff</h2>
            <ul className="space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                Agenda condivisa, gestione disponibilità e ferie.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                Anagrafiche pazienti, richiami e comunicazioni.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                Magazzino, finanza e reportistica per la direzione.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                Ruoli e permessi gestiti dagli amministratori.
              </li>
            </ul>
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-cyan-200">Solo per il team</p>
              <p className="mt-1">I pazienti devono usare l&apos;area dedicata su sorrisosplendente.com.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
