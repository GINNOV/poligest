import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  const t = await getTranslations("app");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold text-emerald-800">
              {t("brand")}
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-zinc-700">
              <Link href="/dashboard" className="hover:text-emerald-700">
                {t("dashboard")}
              </Link>
              <Link href="/agenda" className="hover:text-emerald-700">
                {t("agenda")}
              </Link>
              <Link href="/pazienti" className="hover:text-emerald-700">
                {t("patients")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-700">
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-zinc-900">
                {session?.user?.name ?? session?.user?.email}
              </span>
              <span className="text-xs uppercase text-emerald-700">
                {session?.user?.role ?? ""}
              </span>
            </div>
            <SignOutButton label={t("logout")} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
