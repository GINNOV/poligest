import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Role } from "@prisma/client";
import { NavLink } from "@/components/nav-link";
import { stackServerApp } from "@/lib/stack-app";
import { SiteFooter } from "@/components/site-footer";
import { UserMenu } from "@/components/user-menu";
import { getAppVersion, getDeployDate } from "@/lib/version";
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
  const version = getAppVersion();
  const deployedAt = getDeployDate();

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
      <header className="relative z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
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
                </>
              ) : null}
            </nav>
          </div>
          {user ? (
            <UserMenu
              name={user.name ?? user.email}
              email={user.email}
              avatarUrl={user.avatarUrl ?? null}
              roleLabel={user.role ? roleLabels[user.role] : ""}
              adminHref={isAdmin ? "/admin" : undefined}
              adminLabel={isAdmin ? t("admin") : undefined}
              signOutUrl={signOutUrl}
            />
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <SiteFooter version={version} deployedAt={deployedAt} showDocs />
      {activeUpdate && !dismissed ? <StaffFeatureUpdateDialog update={activeUpdate} /> : null}
    </div>
  );
}
