import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOptionalStackServerApp, getStackSignInUrl } from "@/lib/stack-app";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getAppVersion } from "@/lib/version";
import { PAGE_TITLES } from "@/lib/page-metadata";
import { HomeFeaturesAccordion } from "@/components/home-features-accordion";
import { StaffAccessLink } from "@/components/staff-access-link";

import { Button } from "@/components/ui/button";

export const metadata = { title: { absolute: PAGE_TITLES.home } };

function withParam(url: string, key: string, value: string) {
  const hasQuery = url.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export default async function Home() {
  const stackServerApp = getOptionalStackServerApp();
  const user = stackServerApp ? await stackServerApp.getUser() : null;
  if (user) {
    redirect("/dashboard");
  }

  const t = await getTranslations("home");
  const signInUrl = getStackSignInUrl();
  const patientSignInUrl = withParam(signInUrl, "audience", "patient");
  const staffSignInUrl = withParam(signInUrl, "audience", "staff");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
      <div className="pointer-events-none absolute left-6 top-12 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl sm:left-12 sm:top-16 sm:h-64 sm:w-64" />
      <div className="pointer-events-none absolute bottom-10 right-6 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl sm:bottom-14 sm:right-14 sm:h-72 sm:w-72" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8 lg:gap-10">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:gap-6 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-emerald-100 bg-white sm:h-12 sm:w-12">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt={t("logoAlt")}
                fill
                className="object-contain p-1"
                sizes="48px"
                priority
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900 sm:text-sm sm:tracking-[0.2em]">
                Studio Agovino & Angrisano
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 sm:text-xs sm:tracking-[0.18em]">
                by NoMore Caries
              </p>
            </div>
          </div>
        </header>

        <section>
          <div className="space-y-5 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-[0_24px_80px_-30px_rgba(16,185,129,0.35)] backdrop-blur sm:space-y-6 sm:rounded-3xl sm:p-6 lg:p-8">
            <h1 className="sr-only">Prenota, ricevi documenti e comunica con il tuo dentista</h1>
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_18px_60px_-28px_rgba(16,185,129,0.35)] sm:rounded-3xl">
              <Image
                src="/hero_services.png"
                alt="Servizi disponibili: esame odontoiatrico, trattamento e cartella clinica."
                width={1376}
                height={768}
                className="h-auto w-full object-cover"
                priority
              />
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-center">
              <Button asChild variant="primary" className="w-full rounded-full px-6 py-5 text-base sm:w-auto sm:px-8 sm:py-6 sm:text-lg">
                <Link href={patientSignInUrl}>ACCESSO PAZIENTI</Link>
              </Button>
            </div>

            <HomeFeaturesAccordion />
          </div>
        </section>

        <footer className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-4 text-sm text-zinc-600 shadow-sm backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-center text-xs sm:text-left sm:text-sm">© Garage Innovation LLC — Version: {getAppVersion()}</span>
            <StaffAccessLink href={staffSignInUrl} className="w-full sm:w-auto" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-emerald-100 pt-3 sm:justify-end">
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