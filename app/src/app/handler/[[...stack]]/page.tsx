import Image from "next/image";
import Link from "next/link";
import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";

// Optional catch-all so /handler and /handler/* both work for Stack OAuth callbacks.
export default async function StackAuthHandlerPage(props: {
  params: Promise<{ stack?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const audienceRaw = (searchParams?.audience ?? searchParams?.role ?? "").toLowerCase();
  const isStaff = audienceRaw === "staff";

  const theme = isStaff
    ? {
        bg: "from-slate-950 via-slate-900 to-slate-950",
        headerBg: "bg-slate-900",
        cardBorder: "border-slate-800",
        cardBg: "bg-slate-900/85",
        pill: "bg-cyan-500",
        textPrimary: "text-white",
        textSecondary: "text-slate-100",
        tag: "text-cyan-100",
        badgeBg: "bg-slate-700/70",
        accentBg: "bg-slate-950/60",
        adviceBg: "bg-slate-900/70",
        title: "Accesso staff",
        subtitle: "Portale operativo per segreteria, medici e direzione.",
        help: "Solo per il team interno. Usa le credenziali aziendali o il codice email.",
        linkText: "text-slate-100",
        homeButton: "border-slate-700 bg-slate-800/80 hover:border-slate-500 hover:bg-slate-700 text-slate-50",
      }
    : {
        bg: "from-emerald-50 via-white to-emerald-100",
        cardBorder: "border-emerald-100",
        cardBg: "bg-white",
        pill: "bg-emerald-500",
        textPrimary: "text-zinc-900",
        textSecondary: "text-zinc-600",
        tag: "text-emerald-700",
        badgeBg: "bg-emerald-50/80",
        accentBg: "bg-emerald-50/80",
        adviceBg: "bg-emerald-50/80",
        title: "Area pazienti",
        subtitle: "Prenota visite, ricevi documenti e comunica con lo studio.",
        help: "Rimani su sorrisosplendente.com durante l'accesso per evitare errori.",
        linkText: "text-emerald-800",
        homeButton: "border-white/50 bg-white/80 hover:border-emerald-300 hover:bg-white text-emerald-800",
      };

  return (
    <main className={`relative min-h-screen bg-gradient-to-br ${theme.bg} px-4 py-12 sm:px-6`}>
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-10 top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-6 bottom-6 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header
          className={`flex flex-col justify-between gap-5 rounded-2xl border ${theme.cardBorder} ${theme.headerBg ?? "bg-white/85"} px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center`}
        >
          <div className="flex items-center gap-3">
            <div className={`relative h-12 w-12 overflow-hidden rounded-xl border ${theme.cardBorder} bg-slate-800`}>
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                fill
                className="object-contain p-1"
                sizes="48px"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${theme.tag}`}>{theme.title}</p>
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${theme.textSecondary}`}>
                Studio Agovino & Angrisano
              </p>
            </div>
          </div>
          <Link
            href="/"
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${theme.homeButton} ${theme.linkText}`}
          >
            Torna alla home
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div
            className={`relative overflow-hidden rounded-3xl border ${theme.cardBorder} ${theme.cardBg} p-6 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.45)] backdrop-blur sm:p-8`}
          >
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/20 blur-3xl" />
            <div className="relative space-y-5">
              <div>
                <h1 className={`mt-2 text-2xl font-semibold ${theme.textPrimary} sm:text-3xl`}>
                  {isStaff ? "Portale dello staff" : "Entra nel tuo spazio riservato"}
                </h1>
                <p className={`mt-2 text-sm ${theme.textSecondary}`}>
                  {theme.subtitle}
                </p>
              </div>

              <div className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-4 shadow-sm sm:p-5`}>
                <StackHandler
                  fullPage={false}
                  app={stackServerApp}
                  params={params}
                  searchParams={searchParams}
                />
              </div>

            </div>
          </div>

          <div className={`space-y-4 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} p-6 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.45)] backdrop-blur sm:p-8`}>
            <h2 className={`text-xl font-semibold ${theme.textPrimary}`}>
              {isStaff ? "Operazioni rapide" : "Cosa puoi fare qui"}
            </h2>
            <ul className={`space-y-3 text-sm ${theme.textSecondary}`}>
              {(
                isStaff
                  ? [
                      "Gestisci agenda, disponibilità e richiami dei pazienti.",
                      "Consulta anagrafiche, note cliniche e comunicazioni interne.",
                      "Accedi a magazzino, finanza e report per la direzione.",
                    ]
                  : [
                      "Prenota e gestisci gli appuntamenti con il tuo dentista.",
                      "Consulta documenti clinici e comunicazioni dello studio.",
                      "Ricevi notifiche e promemoria importanti.",
                    ]
              ).map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${theme.pill}`} />
                  {item}
                </li>
              ))}
            </ul>
            <div className={`rounded-xl border ${theme.cardBorder} ${theme.accentBg} px-4 py-3 text-sm ${theme.textPrimary}`}>
              <p className="font-semibold">Assistenza</p>
              <p className={`mt-1 ${theme.textSecondary}`}>
                {isStaff
                  ? "Contatta l'amministratore se l'accesso è bloccato o se devi aggiornare i permessi."
                  : "Problemi con l'accesso? Contatta la segreteria: ti aiuteremo subito."}
              </p>
            </div>
          </div>
        </section>
      </div>
      {isStaff ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .stack-scope h1:first-of-type {
                color: transparent !important;
                position: relative;
              }
              .stack-scope h1:first-of-type::after {
                content: "Personale Studio";
                position: absolute;
                inset: 0;
                color: #e2e8f0;
              }
              .stack-scope,
              .stack-scope p,
              .stack-scope span,
              .stack-scope label {
                color: #e2e8f0 !important;
              }
              .stack-scope a {
                color: #67e8f9 !important;
              }
              .stack-scope input,
              .stack-scope button {
                color: #0f172a !important;
                background-color: #e5e7eb !important;
                border-color: #cbd5e1 !important;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25) !important;
              }
              .stack-scope ::placeholder {
                color: #475569 !important;
              }
              .stack-scope button[type="submit"],
              .stack-scope button[data-stack-button="primary"] {
                color: #0f172a !important;
                background-color: #67e8f9 !important;
                border-color: #22d3ee !important;
              }
            `,
          }}
        />
      ) : null}
    </main>
  );
}
