import Image from "next/image";
import Link from "next/link";
import { StackHandler } from "@stackframe/stack";

export default function StackAuthHandlerPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-10 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute left-10 top-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 sm:gap-10">
        <header className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-white/80 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-900">
                Studio Agovino & Angrisano
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                by NoMore Caries
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:gap-8">
          <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.25)] backdrop-blur sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-200/50 blur-3xl" />
            <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Accedi o registrati
              </p>
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                <StackHandler fullPage={false} />
              </div>
              <p className="text-xs text-zinc-500">
                Se hai bisogno di assistenza per l&apos;accesso, contatta la segreteria dello studio.
              </p>
            </div>
          </section>

          <div className="space-y-3 rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.25)] backdrop-blur sm:p-8">
            <h1 className="text-2xl font-semibold leading-tight text-zinc-900 sm:text-3xl">
              Entra nell&apos;area dello studio
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base sm:leading-7">
              Prenota visite, consulta documenti e gestisci le comunicazioni con il team medico in un ambiente protetto.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
