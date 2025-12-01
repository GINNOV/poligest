import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Role } from "@prisma/client";
import { NavLink } from "@/components/nav-link";

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
  const isManager = user?.role === Role.MANAGER;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold text-emerald-800">
              {t("brand")}
            </Link>
            <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
              <NavLink href="/dashboard" label={t("dashboard")} />
              {isStaff ? (
                <>
                  <NavLink href="/agenda" label={t("agenda")} />
                  <NavLink href="/pazienti" label={t("patients")} />
                  <NavLink href="/richiami" label={t("recalls")} />
                  {isManagerOrAdmin ? (
                    <>
                      <NavLink href="/magazzino" label={t("inventory")} />
                      <NavLink href="/finanza" label={t("finance")} />
                    </>
                  ) : null}
                  {isAdmin ? <NavLink href="/admin" label={t("admin")} /> : null}
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
