import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Role } from "@prisma/client";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const t = await getTranslations("app");
  const isManagerOrAdmin =
    user?.role === Role.ADMIN || user?.role === Role.MANAGER;
  const isAdmin = user?.role === Role.ADMIN;
  const isStaff =
    user?.role === Role.ADMIN ||
    user?.role === Role.MANAGER ||
    user?.role === Role.SECRETARY;

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
              {isStaff ? (
                <>
                  <Link href="/agenda" className="hover:text-emerald-700">
                    {t("agenda")}
                  </Link>
                  <Link href="/pazienti" className="hover:text-emerald-700">
                    {t("patients")}
                  </Link>
                  <Link href="/richiami" className="hover:text-emerald-700">
                    {t("recalls")}
                  </Link>
                  {isManagerOrAdmin ? (
                    <>
                      <Link href="/magazzino" className="hover:text-emerald-700">
                        {t("inventory")}
                      </Link>
                      <Link href="/finanza" className="hover:text-emerald-700">
                        {t("finance")}
                      </Link>
                    </>
                  ) : null}
                  {isAdmin ? (
                    <Link href="/admin" className="hover:text-emerald-700">
                      {t("admin")}
                    </Link>
                  ) : null}
                </>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-700">
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-zinc-900">
                {user?.name ?? user?.email}
              </span>
              <span className="text-xs uppercase text-emerald-700">
                {user?.role ?? ""}
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
