import Image from "next/image";
import Link from "next/link";
import { StackHandler, StackTheme } from "@stackframe/stack";
import type { StackServerApp } from "@stackframe/stack";
import { SiteFooter } from "@/components/site-footer";
import { getStackAuthTheme } from "@/lib/stack-auth-theme";

const STAFF_FEATURES = [
  "Gestisci agenda, disponibilità e richiami dei pazienti.",
  "Consulta anagrafiche, note cliniche e comunicazioni interne.",
  "Accedi a magazzino, finanza e report per la direzione.",
] as const;

const PATIENT_FEATURES = [
  "Prenota e gestisci gli appuntamenti con il tuo dentista.",
  "Consulta documenti clinici e comunicazioni dello studio.",
  "Ricevi notifiche e promemoria importanti.",
] as const;

type StackAuthHandlerShellProps = {
  isStaff: boolean;
  app: StackServerApp;
  params: { stack?: string[] };
  searchParams: Record<string, string | undefined>;
  version: string;
  deployedAt: Date | null;
  displayTimeZone: string;
};

export function StackAuthHandlerShell({
  isStaff,
  app,
  params,
  searchParams,
  version,
  deployedAt,
  displayTimeZone,
}: StackAuthHandlerShellProps) {
  const features = isStaff ? STAFF_FEATURES : PATIENT_FEATURES;
  const stackTheme = getStackAuthTheme(isStaff);

  return (
    <>
      <StackTheme theme={stackTheme} />
      <div
        className={
          isStaff
            ? "relative flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            : "relative flex min-h-screen flex-col bg-gradient-to-br from-emerald-50 via-white to-emerald-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        }
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {isStaff ? (
            <>
              <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-700/30 blur-3xl" />
            </>
          ) : (
            <>
              <div className="absolute left-10 top-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/10" />
              <div className="absolute bottom-6 right-6 h-56 w-56 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/5" />
            </>
          )}
        </div>

        <main className="relative flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 lg:gap-10">
            <header
              className={
                isStaff
                  ? "flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left"
                  : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    isStaff
                      ? "relative h-12 w-12 overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-sm"
                      : "relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  }
                >
                  <Image
                    src="/logo/studio_agovinoangrisano_logo.png"
                    alt="Logo Studio Agovino & Angrisano"
                    fill
                    className="object-contain p-1.5"
                    sizes="48px"
                    priority
                  />
                </div>
                <div className="leading-tight">
                  <p
                    className={
                      isStaff
                        ? "text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"
                        : "text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300"
                    }
                  >
                    {isStaff ? "Accesso staff" : "Area pazienti"}
                  </p>
                  <p
                    className={
                      isStaff
                        ? "text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400"
                        : "text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-800/80 dark:text-slate-400"
                    }
                  >
                    Studio Agovino & Angrisano
                  </p>
                </div>
              </div>

              <Link
                href="/"
                className={
                  isStaff
                    ? "inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
                    : "inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                }
              >
                Torna alla home
              </Link>
            </header>

            <section className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)] lg:gap-8">
              <div className="space-y-5">
                <div className={isStaff ? "space-y-2 text-center sm:text-left" : "space-y-2"}>
                  <h1
                    className={
                      isStaff
                        ? "text-2xl font-semibold tracking-tight text-white sm:text-3xl"
                        : "text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-3xl"
                    }
                  >
                    {isStaff ? "Portale dello staff" : "Entra nel tuo spazio riservato"}
                  </h1>
                  <p
                    className={
                      isStaff
                        ? "text-sm leading-relaxed text-slate-300"
                        : "text-sm leading-relaxed text-zinc-600 dark:text-slate-300"
                    }
                  >
                    {isStaff
                      ? "Portale operativo per segreteria, medici e direzione."
                      : "Prenota visite, ricevi documenti e comunica con lo studio."}
                  </p>
                </div>

                <div className={isStaff ? "stack-auth-surface stack-auth-surface--staff" : "stack-auth-surface"}>
                  <StackHandler fullPage={false} app={app} params={params} searchParams={searchParams} />
                </div>

                <p
                  className={
                    isStaff
                      ? "text-center text-xs text-slate-500 sm:text-left"
                      : "text-xs text-zinc-500 dark:text-slate-400"
                  }
                >
                  {isStaff
                    ? "Solo per il team interno. Usa Google o il codice inviato via email."
                    : "Rimani su sorrisosplendente.com durante l'accesso per evitare errori."}
                </p>
              </div>

              <aside
                className={
                  isStaff
                    ? "space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur sm:p-6"
                    : "space-y-4 rounded-2xl border border-emerald-100 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 sm:p-6"
                }
              >
                <h2
                  className={
                    isStaff
                      ? "text-lg font-semibold text-white"
                      : "text-lg font-semibold text-zinc-900 dark:text-white"
                  }
                >
                  {isStaff ? "Operazioni rapide" : "Cosa puoi fare qui"}
                </h2>
                <ul
                  className={
                    isStaff ? "space-y-3 text-sm text-slate-300" : "space-y-3 text-sm text-zinc-600 dark:text-slate-300"
                  }
                >
                  {features.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span
                        className={
                          isStaff
                            ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400"
                            : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                        }
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className={
                    isStaff
                      ? "rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm"
                      : "rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                  }
                >
                  <p className={isStaff ? "font-semibold text-cyan-200" : "font-semibold text-emerald-900 dark:text-emerald-200"}>
                    Assistenza
                  </p>
                  <p className={isStaff ? "mt-1 text-slate-400" : "mt-1 text-emerald-800 dark:text-slate-400"}>
                    {isStaff
                      ? "Contatta l'amministratore se l'accesso è bloccato o se devi aggiornare i permessi."
                      : "Problemi con l'accesso? Contatta la segreteria: ti aiuteremo subito."}
                  </p>
                </div>
              </aside>
            </section>
          </div>
        </main>

        <div className={isStaff ? "[&_footer]:border-slate-800 [&_footer]:bg-slate-950/90 [&_footer]:text-slate-400 [&_footer_a]:text-cyan-300 [&_footer_span]:text-slate-300" : ""}>
          <SiteFooter version={version} deployedAt={deployedAt} displayTimeZone={displayTimeZone} />
        </div>
      </div>
    </>
  );
}