import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { reportError } from "@/lib/error-reporting";
import { Prisma, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { stackServerApp } from "@/lib/stack-app";
import { redirect } from "next/navigation";
import { ResetLinkBanner } from "@/components/reset-link-banner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { getRandomAvatarUrl } from "@/lib/avatars";
import { sendEmail } from "@/lib/email";
import { buildStaffInviteEmail } from "@/lib/invite-email";
import { ASSISTANT_ROLE } from "@/lib/roles";

const roles: Role[] = [Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY, Role.PATIENT];

async function resolveStackUserIdByEmail(email: string, displayName?: string | null) {
  const normalized = email.trim().toLowerCase();
  const result = await stackServerApp.listUsers({
    query: normalized,
    limit: 50,
    includeRestricted: true,
    includeAnonymous: true,
  });
  const users = Array.isArray(result) ? result : [];
  const match =
    users.find((u) => (u.primaryEmail ?? "").toLowerCase() === normalized) ??
    users.find((u) => (u.primaryEmail ?? "").toLowerCase().includes(normalized)) ??
    null;
  if (match?.id) {
    return match.id as string;
  }
  const fallback = await stackServerApp.listUsers({
    limit: 100,
    includeRestricted: true,
    includeAnonymous: true,
  });
  const fallbackUsers = Array.isArray(fallback) ? fallback : [];
  const fallbackMatch = fallbackUsers.find((u) => (u.primaryEmail ?? "").toLowerCase() === normalized);
  if (fallbackMatch?.id) {
    return fallbackMatch.id as string;
  }
  const created = await stackServerApp.createUser({
    primaryEmail: normalized,
    primaryEmailVerified: false,
    displayName: displayName ?? normalized.split("@")[0],
  });
  if (!created?.id) {
    throw new Error("Impossibile creare l'utente Stack per impersonificazione.");
  }
  return created.id as string;
}

async function upsertUser(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = formData.get("role") as Role;
  const locale = (formData.get("locale") as string) || "it";
  const isActive = formData.get("active") === "on";

  if (!email || !role || !roles.includes(role)) {
    throw new Error("Dati utente non validi");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, locale, isActive },
    create: {
      email,
      name,
      role,
      locale,
      isActive,
      hashedPassword: "",
      avatarUrl: getRandomAvatarUrl(),
    },
  });

  if (!existingUser && isActive) {
    try {
      const sender = stackServerApp as unknown as {
        sendMagicLinkEmail?: (email: string, options?: { callbackUrl?: string }) => Promise<unknown>;
      };
      if (typeof sender.sendMagicLinkEmail !== "function") {
        throw new Error("Stack magic link non disponibile.");
      }
      const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
      if (!callbackUrl) {
        throw new Error("Callback URL mancante per l'invito utente.");
      }
      await sender.sendMagicLinkEmail(user.email, { callbackUrl });

      if (user.role !== Role.PATIENT) {
        const staffEmail = buildStaffInviteEmail(user.role);
        await sendEmail(user.email, staffEmail.subject, staffEmail.text);
      }
    } catch (err) {
      await reportError({
        message: "Errore invio invito utente",
        source: "admin.user.invite",
        path: "/admin/utenti",
        context: { userId: user.id, email: user.email },
        error: err,
        actor: { id: admin.id, role: admin.role },
      });
      throw err instanceof Error ? err : new Error("Invio invito fallito");
    }
  }

  await logAudit(admin, {
    action: "admin.user.upsert",
    entity: "User",
    entityId: user.id,
    metadata: { role, isActive },
  });

  revalidatePath("/admin/utenti");
}

async function setUserStatus(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const userId = formData.get("userId") as string;
  const active = formData.get("active") === "true";
  if (!userId) throw new Error("Utente non valido");

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: active },
  });

  await logAudit(admin, {
    action: active ? "admin.user.activate" : "admin.user.deactivate",
    entity: "User",
    entityId: user.id,
  });

  revalidatePath("/admin/utenti");
}

async function setUserRole(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as Role;
  if (!userId || !role || !roles.includes(role)) {
    throw new Error("Ruolo non valido");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await logAudit(admin, {
    action: "admin.user.role_change",
    entity: "User",
    entityId: user.id,
    metadata: { role },
  });

  revalidatePath("/admin/utenti");
}

async function deleteUser(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN], { allowImpersonation: false });
  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Utente non valido");

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/utenti");
}

async function updateUserDetails(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const userId = formData.get("userId") as string;
  const name = (formData.get("name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const locale = (formData.get("locale") as string) || "it";

  if (!userId || !email) {
    throw new Error("Dati utente non validi");
  }

  const existing = await prisma.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Email già in uso");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, email, locale },
  });

  await logAudit(admin, {
    action: "admin.user.update_details",
    entity: "User",
    entityId: user.id,
    metadata: { locale },
  });

  revalidatePath("/admin/utenti");
}

async function startImpersonation(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const targetUserId = (formData.get("userId") as string)?.trim();
  if (!targetUserId) throw new Error("Utente non valido");
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isActive: true, email: true, name: true },
  });
  if (!target) throw new Error("Utente non trovato");
  if (!target.isActive) throw new Error("Non è possibile impersonare un utente disattivato.");
  if (!target.email) throw new Error("L'utente non ha un'email valida per l'impersonificazione.");

  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
  if (!projectId) throw new Error("Project ID Stack mancante");

  // Resolve the Stack user id by email to generate an impersonation session.
  const stackUserId = await resolveStackUserIdByEmail(target.email, target.name);

  // Create a short-lived session flagged as impersonation.
  const stackServerAppWithInterface = stackServerApp as typeof stackServerApp & {
    _interface: {
      createServerUserSession: (
        userId: string,
        expiresInMs: number,
        isImpersonation: boolean
      ) => Promise<{ accessToken: string; refreshToken: string }>;
    };
  };
  const { accessToken, refreshToken } = await stackServerAppWithInterface._interface.createServerUserSession(
    stackUserId,
    1000 * 60 * 60 * 6, // 6 hours
    true,
  );

  const store = await cookies();
  const currentAccess = store.get(`stack-access-${projectId}`)?.value;
  const currentRefresh = store.get(`stack-refresh-${projectId}`)?.value;

  if (currentAccess) {
    store.set("impersonateAdminAccess", currentAccess, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 6,
    });
  }
  if (currentRefresh) {
    store.set("impersonateAdminRefresh", currentRefresh, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 6,
    });
  }

  store.set("impersonateUserId", target.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour
  });
  store.set("impersonateAdminId", admin.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour
  });
  store.set(`stack-access-${projectId}`, accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 6,
  });
  store.set(`stack-refresh-${projectId}`, refreshToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 6,
  });

  await logAudit(admin, {
    action: "admin.user.impersonate",
    entity: "User",
    entityId: target.id,
    metadata: { impersonated: true },
  });

  revalidatePath("/");
}

async function sendPasswordResetLink(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const userId = formData.get("userId") as string;
  const returnToRaw = (formData.get("returnTo") as string) || "/admin/utenti";
  if (!userId) throw new Error("Utente non valido");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    throw new Error("Email utente non valida");
  }

  try {
    const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
    if (!callbackUrl) {
      throw new Error("Callback URL mancante per il reset password.");
    }
    const result = await stackServerApp.sendForgotPasswordEmail(user.email, { callbackUrl });
    if (result && typeof result === "object" && "status" in result && result.status === "error") {
      const message =
        typeof (result as { error?: { message?: string } }).error?.message === "string"
          ? (result as { error?: { message?: string } }).error?.message
          : "Errore invio link reset password.";
      throw new Error(message);
    }
  } catch (err) {
    const stackMessage =
      err && typeof err === "object"
        ? (err as { humanReadableMessage?: string; message?: string }).humanReadableMessage ??
          (err as { message?: string }).message
        : null;
    const message =
      stackMessage?.trim() ||
      "Impossibile inviare il link: verifica che l'utente abbia un'email valida.";
    await reportError({
      message: "Errore invio link reset password",
      source: "admin.reset_password",
      path: "/admin/utenti",
      context: { userId: user.id, email: user.email },
      error: err,
      actor: { id: admin.id, role: admin.role },
    });
    throw new Error(message);
  }

  await logAudit(admin, {
    action: "admin.user.reset_password",
    entity: "User",
    entityId: user.id,
  });

  const url = new URL(returnToRaw, "http://localhost");
  url.searchParams.set("resetSent", "1");
  url.searchParams.set("resetEmail", user.email);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

async function stopImpersonation() {
  "use server";

  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const store = await cookies();
  const current = store.get("impersonateUserId")?.value;
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;

  const originalAccess = store.get("impersonateAdminAccess")?.value;
  const originalRefresh = store.get("impersonateAdminRefresh")?.value;

  if (projectId) {
    if (originalAccess) {
      store.set(`stack-access-${projectId}`, originalAccess, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 6,
      });
    } else {
      store.delete(`stack-access-${projectId}`);
    }

    if (originalRefresh) {
      store.set(`stack-refresh-${projectId}`, originalRefresh, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 6,
      });
    } else {
      store.delete(`stack-refresh-${projectId}`);
    }
  }

  store.delete("impersonateUserId");
  store.delete("impersonateAdminId");
  store.delete("impersonateAdminAccess");
  store.delete("impersonateAdminRefresh");

  if (current) {
    await logAudit(admin, {
      action: "admin.user.stop_impersonation",
      entity: "User",
      entityId: current,
    });
  }

  revalidatePath("/");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  const t = await getTranslations("admin");
  const params = await searchParams;
  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get("impersonateUserId")?.value ?? null;
  const impersonatedUser = impersonatedUserId
    ? await prisma.user.findUnique({
        where: { id: impersonatedUserId },
        select: { id: true, name: true, email: true, role: true },
      })
    : null;
  const queryParam = params.q;
  const queryValue =
    typeof queryParam === "string"
      ? queryParam.trim()
      : Array.isArray(queryParam)
        ? queryParam[0]?.trim()
        : "";
  const query = queryValue || undefined;

  const roleParam = params.role;
  const roleValue =
    typeof roleParam === "string"
      ? roleParam.trim()
      : Array.isArray(roleParam)
        ? roleParam[0]?.trim()
        : "";
  const roleFilter = roles.includes(roleValue as Role) ? (roleValue as Role) : undefined;
  const resetSentParam = params.resetSent;
  const resetEmailParam = params.resetEmail;
  const resetSent =
    typeof resetSentParam === "string"
      ? resetSentParam === "1"
      : Array.isArray(resetSentParam)
        ? resetSentParam[0] === "1"
        : false;
  const resetEmail =
    typeof resetEmailParam === "string"
      ? resetEmailParam
      : Array.isArray(resetEmailParam)
        ? resetEmailParam[0]
        : "";

  const queryParams = new URLSearchParams();
  if (query) queryParams.set("q", query);
  if (roleFilter) queryParams.set("role", roleFilter);

  const whereConditions: Prisma.UserWhereInput[] = [];
  if (roleFilter) whereConditions.push({ role: roleFilter });
  if (query) {
    whereConditions.push({
      OR: [
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }
  const where: Prisma.UserWhereInput | undefined = whereConditions.length
    ? { AND: whereConditions }
    : undefined;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      locale: true,
      createdAt: true,
      lastLoginAt: true,
      avatarUrl: true,
    },
  });

  const roleLabels: Record<Role, string> = {
    [Role.ADMIN]: "Admin",
    [Role.MANAGER]: "Dottore",
    [Role.ASSISTANT]: "Assistente",
    [Role.SECRETARY]: "Segreteria",
    [Role.PATIENT]: "Paziente",
  };

  const roleBadgeStyles: Record<Role, string> = {
    [Role.ADMIN]: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50",
    [Role.MANAGER]: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
    [Role.ASSISTANT]: "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50",
    [Role.SECRETARY]: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    [Role.PATIENT]: "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{t("users")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("usersHeading")}
          </h1>
          <p className="max-w-2xl text-zinc-500 dark:text-zinc-400">
            {t("usersSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            {users.slice(0, 5).map((u) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={u.id}
                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-950"
                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${u.name || u.email}&background=random`}
                alt={u.name || u.email}
              />
            ))}
            {users.length > 5 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 ring-2 ring-white dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-950">
                +{users.length - 5}
              </div>
            )}
          </div>
          <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {users.length} {t("usersList").toLowerCase()}
          </div>
        </div>
      </div>

      {/* Impersonation Banner */}
      {impersonatedUser && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm backdrop-blur-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {t("impersonationActive")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("viewingAs")} <span className="font-bold">{impersonatedUser.name || impersonatedUser.email}</span> ({roleLabels[impersonatedUser.role as Role] || impersonatedUser.role})
              </p>
            </div>
          </div>
          <form action={stopImpersonation}>
            <Button type="submit" size="sm" variant="outline" className="bg-amber-600 border-amber-600 text-white hover:bg-amber-700 hover:border-amber-700 font-bold">
              {t("exit")}
            </Button>
          </form>
        </div>
      )}

      {/* Notifications */}
      {resetSent && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <ResetLinkBanner
            title={t("resetLinkSentTitle")}
            body={t("resetLinkSentBody", { email: resetEmail || "—" })}
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: User List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center">
            <form method="get" action="/admin/utenti" className="flex flex-1 items-center gap-2 px-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  name="q"
                  defaultValue={query ?? ""}
                  placeholder={t("searchPlaceholder")}
                  className="h-10 w-full rounded-xl border-none bg-transparent pl-10 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-50"
                />
              </div>
              <div className="h-6 w-px bg-zinc-100 dark:bg-zinc-800" />
              <select
                name="role"
                defaultValue={roleFilter ?? ""}
                className="h-10 border-none bg-transparent text-xs font-semibold text-zinc-700 outline-none focus:ring-0 dark:text-zinc-300"
              >
                <option value="">Tutti i ruoli</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r] || r}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="xs"
                variant="primary"
                className="ml-auto h-8 w-8 p-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Button>
              {(query || roleFilter) && (
                <Button
                  asChild
                  variant="ghost"
                  size="xs"
                  className="h-8 w-8 p-0"
                ><Link href="/admin/utenti">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Link></Button>
              )}
            </form>
          </div>

          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 py-12 dark:border-zinc-800">
                <div className="rounded-full bg-zinc-50 p-3 dark:bg-zinc-900">
                  <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">Nessun utente trovato</p>
                <p className="mt-1 text-xs text-zinc-500">Prova a cambiare i filtri di ricerca</p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="group relative flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-900/50"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name || user.email}&background=random`}
                          alt={user.name || user.email}
                          className="h-12 w-12 rounded-full border border-zinc-100 object-cover dark:border-zinc-800"
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ring-zinc-100 dark:border-zinc-950 dark:ring-zinc-800 ${user.isActive ? "bg-emerald-500" : "bg-zinc-300"}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                            {user.name || t("unnamed")}
                          </h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadgeStyles[user.role as Role] || roleBadgeStyles[Role.PATIENT]}`}>
                            {roleLabels[user.role as Role] || user.role}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-[10px] text-zinc-400">
                          <div className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            {user.locale.toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {user.lastLoginAt ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(user.lastLoginAt) : t("neverLoggedIn")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <div className={user.id === admin.id || !user.isActive ? "hidden" : "block"}>
                        <ConfirmButton
                          action={startImpersonation}
                          name="userId"
                          value={user.id}
                          confirmMessage={t("impersonateConfirm")}
                          variant="secondary"
                          size="xs"
                          className="gap-2"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {t("impersonate")}
                        </ConfirmButton>
                      </div>
                      <ConfirmButton
                        action={sendPasswordResetLink}
                        name="userId"
                        value={user.id}
                        confirmMessage={t("sendResetConfirm")}
                        variant="ghost"
                        size="xs"
                        className="h-8 w-8 p-0"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </ConfirmButton>
                      <ConfirmButton
                        action={setUserStatus}
                        data={{ userId: user.id, active: (!user.isActive).toString() }}
                        confirmMessage={t("toggleStatusConfirm")}
                        variant="ghost"
                        size="xs"
                        className={`h-8 w-8 p-0 ${user.isActive ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
                        title={t("toggle")}
                      >
                        {user.isActive ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </ConfirmButton>
                      <ConfirmButton
                        action={deleteUser}
                        name="userId"
                        value={user.id}
                        confirmMessage={t("deleteConfirm")}
                        variant="ghost"
                        size="xs"
                        className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </ConfirmButton>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-xl bg-zinc-50/50 p-4 dark:bg-zinc-900/50 sm:grid-cols-2">
                    <form action={updateUserDetails} className="flex flex-col gap-3">
                      <input type="hidden" name="userId" value={user.id} />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="name"
                          defaultValue={user.name ?? ""}
                          placeholder={t("name")}
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                        />
                        <select
                          name="locale"
                          defaultValue={user.locale}
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                        >
                          <option value="it">Italiano</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input
                          name="email"
                          type="email"
                          defaultValue={user.email}
                          placeholder={t("email")}
                          required
                          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="black"
                          className="h-9 px-3 gap-2"
                        >
                          {t("save")}
                        </Button>
                      </div>
                    </form>

                    <form action={setUserRole} className="flex flex-col justify-end gap-3">
                      <input type="hidden" name="userId" value={user.id} />
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t("changeRole")}</label>
                        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="flex gap-2">
                        <select
                          name="role"
                          key={`${user.id}-${user.role}`}
                          defaultValue={user.role}
                          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {roleLabels[r] || r}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          size="sm"
                          variant="primary"
                          className="h-9 px-3 gap-2"
                        >
                          {t("apply")}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Create User Form */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("createUser")}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Nuovo accesso allo studio</p>
              </div>
            </div>

            <form action={upsertUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 pl-1">{t("name")}</label>
                <input
                  name="name"
                  placeholder="es. Mario Rossi"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 pl-1">{t("email")}</label>
                <input
                  name="email"
                  type="email"
                  placeholder="mario.rossi@esempio.it"
                  required
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 pl-1">{t("role")}</label>
                  <select
                    name="role"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                    defaultValue={Role.SECRETARY}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabels[r] || r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 pl-1">{t("locale")}</label>
                  <select
                    name="locale"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-900/30"
                    defaultValue="it"
                  >
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <input
                  type="checkbox"
                  id="active-check"
                  name="active"
                  className="h-5 w-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  defaultChecked
                />
                <label htmlFor="active-check" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  {t("active")}
                </label>
              </div>

              <p className="px-1 text-[10px] text-zinc-400 leading-relaxed italic">
                {t("usersFormHelper")}
              </p>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-12 gap-2 text-sm font-bold shadow-lg"
              >
                <span>{t("saveUser")}</span>
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
