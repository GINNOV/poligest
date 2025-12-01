import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { stackServerApp } from "@/lib/stack-app";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await stackServerApp.getUser();
  if (user) {
    redirect("/dashboard");
  }

  const t = await getTranslations("home");
  const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-emerald-50 px-6 py-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-zinc-100">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {t("tagline")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-600 sm:text-xl">
            {t("heroSubtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={signInUrl}
            className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href={signInUrl}
            className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-6 py-3 text-base font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </div>
    </main>
  );
}
