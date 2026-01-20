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
import { type FeatureId, getRoleFeatureAccess } from "@/lib/feature-access";
import { StaffFeatureUpdateDialog } from "@/components/staff-feature-update-dialog";
import { MobileNav } from "@/components/mobile-nav";
import { logAudit } from "@/lib/audit";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { AppStartRedirect } from "@/components/app-start-redirect";

async function stopImpersonation() {
  "use server";

  const store = await cookies();
  const current = store.get("impersonateUserId")?.value;
  const adminId = store.get("impersonateAdminId")?.value ?? null;
  const admin = adminId
    ? await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } })
    : null;
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
  if (projectId) {
    store.delete(`stack-access-${projectId}`);
    store.delete(`stack-refresh-${projectId}`);
  }
  store.delete("impersonateUserId");
  store.delete("impersonateAdminId");

  if (current) {
    await logAudit(admin?.role === Role.ADMIN ? admin : null, {
      action: "admin.user.stop_impersonation",
      entity: "User",
      entityId: current,
    });
  }

  redirect("/dashboard");
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const store = await cookies();
  const impersonateUserId = store.get("impersonateUserId")?.value ?? null;
  const isImpersonating = Boolean(user?.impersonatedFrom || impersonateUserId);
  const t = await getTranslations("app");
  const isManagerOrAdmin =
    user?.role === Role.ADMIN || user?.role === Role.MANAGER;
  const isAdmin = user?.role === Role.ADMIN;
  const isStaff =
    user?.role === Role.ADMIN ||
    user?.role === Role.MANAGER ||
    user?.role === ASSISTANT_ROLE ||
    user?.role === Role.SECRETARY;
  const featureAccess = isStaff && user?.role
    ? await getRoleFeatureAccess(user.role)
    : null;
  const isFeatureAllowed = (feature: FeatureId) =>
    featureAccess?.isAllowed(feature) ?? false;
  const isAgendaAllowed = isStaff && isFeatureAllowed("agenda");
  const isCalendarAllowed = isStaff && isFeatureAllowed("calendar");
  const isPatientsAllowed = isStaff && isFeatureAllowed("patients");
  const isInventoryAllowed = isStaff && isFeatureAllowed("inventory");
  const isFinanceAllowed = isStaff && isFeatureAllowed("finance");
  const allowedHomeScreens = [
    "/dashboard",
    ...(isAgendaAllowed ? ["/agenda"] : []),
    ...(isPatientsAllowed ? ["/pazienti"] : []),
    ...(isFinanceAllowed && isManagerOrAdmin ? ["/finanza"] : []),
    ...(isInventoryAllowed && isManagerOrAdmin ? ["/magazzino"] : []),
  ];
  const roleLabels: Record<string, string> = {
    [Role.ADMIN]: t("roleLabels.admin"),
    [Role.MANAGER]: t("roleLabels.manager"),
    [ASSISTANT_ROLE]: t("roleLabels.assistant"),
    [Role.SECRETARY]: t("roleLabels.secretary"),
    [Role.PATIENT]: t("roleLabels.patient"),
  };
  const signOutUrl = stackServerApp.urls.signOut ?? "/handler/sign-out";
  const version = getAppVersion();
  const deployedAt = getDeployDate();
  const navLinks = [
    { href: "/dashboard", label: "Giornata" },
    ...(isAgendaAllowed ? [{ href: "/agenda", label: t("agenda") }] : []),
    ...(isPatientsAllowed ? [{ href: "/pazienti", label: t("patients") }] : []),
    ...(isAgendaAllowed ? [{ href: "/richiami", label: t("recalls") }] : []),
    ...(isManagerOrAdmin && isInventoryAllowed ? [{ href: "/magazzino", label: t("inventory") }] : []),
    ...(isManagerOrAdmin && isFinanceAllowed ? [{ href: "/finanza", label: t("finance") }] : []),
    ...(user ? [{ href: "/profilo", label: "Profilo" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: t("admin") }] : []),
  ];

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
        {isImpersonating && user ? (
          <div className="border-b border-amber-200 bg-amber-50">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm text-amber-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  Impersonificazione attiva: {user.name ?? user.email} ({user.role})
                </span>
                <span className="text-xs text-amber-800">Stai navigando come questo utente.</span>
              </div>
              <form action={stopImpersonation}>
                <button className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">
                  Termina impersonazione
                </button>
              </form>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href="/dashboard" className="text-lg font-semibold text-emerald-800">
              {t("brand")}
            </Link>
            <nav className="hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 lg:flex">
              <NavLink href="/dashboard" label="Giornata" />
              {isStaff ? (
                <>
                  {isAgendaAllowed ? <NavLink href="/agenda" label={t("agenda")} /> : null}
                  {isPatientsAllowed ? <NavLink href="/pazienti" label={t("patients")} /> : null}
                  {isAgendaAllowed ? <NavLink href="/richiami" label={t("recalls")} /> : null}
                  {isManagerOrAdmin ? (
                    <>
                      {isInventoryAllowed ? <NavLink href="/magazzino" label={t("inventory")} /> : null}
                      {isFinanceAllowed ? <NavLink href="/finanza" label={t("finance")} /> : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <MobileNav links={navLinks} />
            {user ? (
              <UserMenu
                name={user.name ?? user.email}
                email={user.email}
                avatarUrl={user.avatarUrl ?? null}
                roleLabel={user.role ? roleLabels[user.role] : ""}
                allowedHomeScreens={allowedHomeScreens}
                adminHref={isAdmin ? "/admin" : undefined}
                adminLabel={isAdmin ? t("admin") : undefined}
                signOutUrl={signOutUrl}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <AppStartRedirect />
      <SiteFooter version={version} deployedAt={deployedAt} showDocs />
      {activeUpdate && !dismissed ? <StaffFeatureUpdateDialog update={activeUpdate} /> : null}
    </div>
  );
}
