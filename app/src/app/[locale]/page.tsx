import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { stackServerApp } from "@/lib/stack-app";
import { redirect } from "next/navigation";
import Image from "next/image";

const commitHash = "39e2a90";

export default async function Home() {
  const user = await stackServerApp.getUser();
  if (user) {
    redirect("/dashboard");
  }

  const t = await getTranslations("home");
  const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-6 py-14">
      <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-10 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between gap-6 rounded-2xl border border-emerald-100/60 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt={t("logoAlt")}
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
            href={signInUrl}
            className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            {t("ctaSecondary")}
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-10">
          <section className="space-y-6 rounded-3xl border border-emerald-100 bg-white/90 p-8 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.25)] backdrop-blur">
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-zinc-600 sm:text-xl">
              {t("heroSubtitle")}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={signInUrl}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                {t("ctaPrimary")}
              </Link>
            </div>

            <p className="text-sm text-zinc-600">{t("support")}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                t("pillars.patientAccess"),
                t("pillars.paperless"),
                t("pillars.privacy"),
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl bg-emerald-50/70 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.35)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-emerald-100 bg-white/90 p-8 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-emerald-700">{t("rolesTitle")}</p>
              <h2 className="text-2xl font-semibold text-zinc-900">{t("rolesSubtitle")}</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: t("roles.patients.title"),
                desc: t("roles.patients.desc"),
                accent: "bg-emerald-50 border-emerald-100 text-emerald-900",
              },
              {
                title: t("roles.doctors.title"),
                desc: t("roles.doctors.desc"),
                accent: "bg-sky-50 border-sky-100 text-sky-900",
              },
              {
                title: t("roles.staff.title"),
                desc: t("roles.staff.desc"),
                accent: "bg-amber-50 border-amber-100 text-amber-900",
              },
            ].map((role) => (
              <div
                key={role.title}
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 shadow-sm ${role.accent}`}
              >
                <span className="text-sm font-semibold uppercase tracking-[0.12em]">{role.title}</span>
                <p className="text-sm leading-relaxed text-zinc-700">{role.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-white/80 px-5 py-4 text-sm text-zinc-600 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <span>© Garage Innovation LLC — Version: {commitHash}</span>
          <Link
            href="/privacy"
            className="text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-800"
          >
            Privacy
          </Link>
        </footer>
      </div>
    </main>
  );
}
