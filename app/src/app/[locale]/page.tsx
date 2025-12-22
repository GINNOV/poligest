import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { stackServerApp } from "@/lib/stack-app";
import { redirect } from "next/navigation";
import Image from "next/image";

const commitHash = "39e2a90";

function withParam(url: string, key: string, value: string) {
  const hasQuery = url.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export default async function Home() {
  const user = await stackServerApp.getUser();
  if (user) {
    redirect("/dashboard");
  }

  const t = await getTranslations("home");
  const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";
  const patientSignInUrl = withParam(signInUrl, "audience", "patient");
  const staffSignInUrl = withParam(signInUrl, "audience", "staff");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-6 py-14">
      <div className="pointer-events-none absolute left-12 top-16 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-14 bottom-14 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between gap-6 rounded-2xl border border-emerald-100/60 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt={t("logoAlt")}
                fill
                className="object-contain p-1"
                sizes="48px"
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
        </header>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-6 rounded-3xl border border-emerald-100 bg-white/90 p-8 shadow-[0_24px_80px_-30px_rgba(16,185,129,0.35)] backdrop-blur">
            <h1 className="sr-only">Prenota, ricevi documenti e comunica con il tuo dentista</h1>
            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_18px_60px_-28px_rgba(16,185,129,0.35)]">
              <Image
                src="/hero_services.png"
                alt="Servizi disponibili: esame odontoiatrico, trattamento e cartella clinica."
                width={1376}
                height={768}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href={patientSignInUrl}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                ACCESSO PAZIENTI
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Gestisci appuntamenti",
                  desc: "Prenota, sposta o cancella visite senza chiamare in studio.",
                },
                {
                  title: "Documenti sempre disponibili",
                  desc: "Scarica referti, piani di cura e ricevute quando ti servono.",
                },
                {
                  title: "Promemoria e notifiche",
                  desc: "Ricevi avvisi per i controlli e messaggi dallo studio.",
                },
                {
                  title: "Massima privacy",
                  desc: "Accesso cifrato e dati custoditi su infrastruttura sicura.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-left shadow-[0_12px_40px_-24px_rgba(16,185,129,0.35)]"
                >
                  <p className="text-sm font-semibold text-emerald-900">{item.title}</p>
                  <p className="mt-1 text-sm text-emerald-800">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-900 shadow-sm backdrop-blur">
          <p className="text-base font-semibold">Serve aiuto?</p>
          <p className="mt-1 text-base text-emerald-800">
            <a
              href="mailto:studio.agovino.angrisano@gmail.com"
              className="font-semibold underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-900"
            >
              Scrivi
            </a>{" "}
            alla segreteria: ti invieremo un nuovo codice o ti guideremo nell&apos;accesso.
          </p>
        </section>

        <footer className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-white/80 px-5 py-4 text-sm text-zinc-600 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <span>© Garage Innovation LLC — Version: {commitHash}</span>
          <div className="flex items-center gap-3">
            <Link
              href={staffSignInUrl}
              className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-800"
            >
              Accesso staff
            </Link>
            <Link
              href="/docs"
              className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-800"
            >
              Manuale
            </Link>
            <Link
              href="/privacy"
              className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-800"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-800"
            >
              Termini
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
