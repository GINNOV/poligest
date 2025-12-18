import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Role } from "@prisma/client";
import { NavLink } from "@/components/nav-link";
import { stackServerApp } from "@/lib/stack-app";
import { SiteFooter } from "@/components/site-footer";
import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { FALLBACK_PERMISSIONS } from "@/lib/feature-access";
import { StaffFeatureUpdateDialog } from "@/components/staff-feature-update-dialog";

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
  const featureAccess = isStaff && user?.role
    ? await prisma.roleFeatureAccess.findMany({ where: { role: user.role } })
    : [];
  const featureAccessMap = new Map(
    featureAccess.map((access) => [`${access.role}-${access.feature}`, access.allowed])
  );
  const isCalendarAllowed =
    isStaff && user?.role
      ? featureAccessMap.get(`${user.role}-calendar`) ??
        (FALLBACK_PERMISSIONS[user.role]?.has("calendar") ?? false)
      : false;
  const roleLabels: Record<Role, string> = {
    [Role.ADMIN]: t("roleLabels.admin"),
    [Role.MANAGER]: t("roleLabels.manager"),
    [Role.SECRETARY]: t("roleLabels.secretary"),
    [Role.PATIENT]: t("roleLabels.patient"),
  };
  const signOutUrl = stackServerApp.urls.signOut ?? "/handler/sign-out";
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    (() => {
      try {
        return execSync("git rev-parse --short HEAD").toString().trim();
      } catch {
        return "unknown";
      }
    })();

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const featureUpdateClient = prismaModels["featureUpdate"] as
    | { findFirst?: (args: unknown) => Promise<unknown> }
    | undefined;
  const dismissalClient = prismaModels["featureUpdateDismissal"] as
    | { findUnique?: (args: unknown) => Promise<unknown> }
    | undefined;

  const activeUpdate =
    isStaff && user?.id && featureUpdateClient?.findFirst
      ? ((await featureUpdateClient.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        })) as { id: string; title: string; bodyMarkdown: string } | null)
      : null;

  const dismissed =
    isStaff && user?.id && activeUpdate?.id && dismissalClient?.findUnique
      ? await dismissalClient.findUnique({
          where: { user_feature_update_unique: { userId: user.id, featureUpdateId: activeUpdate.id } },
          select: { id: true },
        })
      : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold text-emerald-800">
              {t("brand")}
            </Link>
            <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
              <NavLink href="/dashboard" label="Cruscotto" />
              {isStaff ? (
                <>
                  <NavLink href="/agenda" label={t("agenda")} />
                  {isCalendarAllowed ? (
                    <NavLink href="/calendar" label={t("calendar")} />
                  ) : null}
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
            <Link href="/profilo" className="flex items-center gap-3 hover:text-emerald-800">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="h-9 w-9 rounded-full border border-zinc-200 object-cover"
                />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                  {(user?.name ?? user?.email ?? "U")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </div>
              )}
              <span className="font-semibold text-zinc-900">{user?.name ?? user?.email}</span>
              <span className="text-xs uppercase text-emerald-700">{user?.role ? roleLabels[user.role] : ""}</span>
            </Link>
            <SignOutButton label={t("logout")} signOutUrl={signOutUrl} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <SiteFooter version={version} />
      {activeUpdate && !dismissed ? <StaffFeatureUpdateDialog update={activeUpdate} /> : null}
    </div>
  );
}
