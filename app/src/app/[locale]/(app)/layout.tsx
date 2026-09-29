import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import { NavLink } from "@/components/nav-link";
import { getStackSignOutUrl } from "@/lib/stack-app";
import { SiteFooter } from "@/components/site-footer";
import { UserMenu } from "@/components/user-menu";
import { getAppVersion, getDeployDate } from "@/lib/version";
import { type FeatureId, getRoleFeatureAccess } from "@/lib/feature-access";
import { StaffFeatureUpdateDialog } from "@/components/staff-feature-update-dialog";
import { HelpButton, type Instruction } from "@/components/help-button";
import { MobileNav } from "@/components/mobile-nav";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { cookies } from "next/headers";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { StopImpersonationButton } from "@/components/stop-impersonation-button";
import { AppStartRedirect } from "@/components/app-start-redirect";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";

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
  const isPatientsAllowed = isStaff && isFeatureAllowed("patients");
  const isInventoryAllowed = isStaff && isFeatureAllowed("inventory");
  const isFinanceAllowed = isStaff && isFeatureAllowed("finance");

  const instructionClient = getOptionalPrismaModel<{
    findMany: (args: unknown) => Promise<Instruction[]>;
  }>("featureInstruction");

  const instructions =
    isStaff && user && instructionClient
      ? await instructionClient.findMany({
          where: { isActive: true },
          include: { steps: { orderBy: { sortOrder: "asc" } } },
        })
      : [];

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
  const signOutUrl = getStackSignOutUrl();
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
  const practiceTimeZone = await getPracticeTimeZone();
  const displayTimeZone = await getUserDisplayTimeZone();

  const featureUpdateClient = getOptionalPrismaModel<
    | { findFirst?: (args: unknown) => Promise<unknown> }
  >("featureUpdate");
  const dismissalClient = getOptionalPrismaModel<
    | { findUnique?: (args: unknown) => Promise<unknown> }
  >("featureUpdateDismissal");

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 print:bg-white print:text-black">
      <header className="relative z-40 border-b border-zinc-200 bg-white/80 backdrop-blur print:hidden dark:border-zinc-800 dark:bg-zinc-950/85">
        {isImpersonating && user ? (
          <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm text-amber-900 dark:text-amber-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  Impersonificazione attiva: {user.name ?? user.email} ({user.role})
                </span>
                <span className="text-xs text-amber-800 dark:text-amber-200">Stai navigando come questo utente.</span>
              </div>
              <StopImpersonationButton
                label="Termina impersonazione"
                nextHref="/dashboard"
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
              />
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href="/dashboard" className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              {t("brand")}
            </Link>
            <nav className="hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-300 lg:flex">
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
            {isStaff && user && (
              <HelpButton
                instructions={instructions}
                userRole={user.role}
                userId={user.id}
              />
            )}
            <MobileNav links={navLinks} />
            {user ? (
              <UserMenu
                name={user.name ?? user.email}
                email={user.email}
                avatarUrl={user.avatarUrl ?? null}
                roleLabel={user.role ? roleLabels[user.role] : ""}
                isStaff={isStaff}
                allowedHomeScreens={allowedHomeScreens}
                adminHref={isAdmin ? "/admin" : undefined}
                adminLabel={isAdmin ? t("admin") : undefined}
                instructionsHref={user.role === Role.MANAGER ? "/admin/istruzioni" : undefined}
                instructionsLabel={user.role === Role.MANAGER ? "Istruzioni funzionalità" : undefined}
                signOutUrl={signOutUrl}
                practiceTimeZone={practiceTimeZone}
                displayTimeZone={displayTimeZone}
                canManagePracticeTimeZone={isManagerOrAdmin}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 print:max-w-none print:px-0 print:py-0">{children}</main>
      <AppStartRedirect />
      <div className="print:hidden">
        <SiteFooter version={version} deployedAt={deployedAt} displayTimeZone={displayTimeZone} showDocs />
      </div>
      {activeUpdate && !dismissed ? (
        <div className="print:hidden">
          <StaffFeatureUpdateDialog update={activeUpdate} />
        </div>
      ) : null}
    </div>
  );
}
