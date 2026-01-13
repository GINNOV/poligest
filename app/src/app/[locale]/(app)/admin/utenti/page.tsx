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
  const { accessToken, refreshToken } = await (stackServerApp as any)._interface.createServerUserSession(
    stackUserId,
    1000 * 60 * 60 * 6, // 6 hours
    true,
  );

  const store = await cookies();
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
    const result = await stackServerApp.sendForgotPasswordEmail(user.email);
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
  if (projectId) {
    store.delete(`stack-access-${projectId}`);
    store.delete(`stack-refresh-${projectId}`);
  }
  store.delete("impersonateUserId");
  store.delete("impersonateAdminId");

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
    ? await prisma.user.findUnique({ where: { id: impersonatedUserId }, select: { id: true, name: true, email: true, role: true } })
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
  const returnTo = `/admin/utenti${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

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
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("users")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">{t("usersHeading")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t("usersSubtitle")}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <form
            method="get"
            action="/admin/utenti"
            className="flex w-full items-center gap-2 sm:w-auto"
          >
            <input
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder="Cerca per nome o email"
              className="h-10 w-full rounded-full border border-zinc-200 px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-64"
            />
            <select
              name="role"
              defaultValue={roleFilter ?? ""}
              className="h-10 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filtra per ruolo"
            >
              <option value="">Tutti i ruoli</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Cerca
            </button>
            {query || roleFilter ? (
              <Link
                href="/admin/utenti"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Reset
              </Link>
            ) : null}
          </form>
          <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-800">
            {users.length} utenti
          </span>
        </div>
      </div>
      {impersonatedUser ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                Impersonificazione attiva: {impersonatedUser.name ?? impersonatedUser.email} ({impersonatedUser.role})
              </p>
              <p className="text-xs text-amber-800">
                Stai navigando come questo utente. Le aree admin continuano a mostrarti il tuo account reale.
              </p>
            </div>
            <form action={stopImpersonation}>
              <button className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">
                Torna al mio account
              </button>
            </form>
          </div>
        </div>
      ) : null}
      {resetSent ? (
        <ResetLinkBanner
          title={t("resetLinkSentTitle")}
          body={t("resetLinkSentBody", { email: resetEmail || "—" })}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <details className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden" open>
          <summary className="flex cursor-pointer items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">{t("usersList")}</h2>
            <svg
              className="h-5 w-5 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>

          <div className="mt-4 divide-y divide-zinc-100">
            {users.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">Nessun utente.</p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 rounded-xl py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0 sm:flex-1">
                    <div className="font-semibold text-zinc-900">
                      {user.name ?? user.email}
                    </div>
                    {impersonatedUserId === user.id ? (
                      <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        Stai impersonando questo utente
                      </div>
                    ) : null}
                    <div className="text-xs text-zinc-600">
                      {user.email} · {user.locale} ·{" "}
                      {user.lastLoginAt
                        ? new Intl.DateTimeFormat("it-IT", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(user.lastLoginAt)
                        : "Mai"}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:max-w-xl">
                    <form
                      action={updateUserDetails}
                      className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[1.2fr,1.2fr,0.8fr,auto]"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        name="name"
                        defaultValue={user.name ?? ""}
                        placeholder={t("name")}
                        className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        name="email"
                        type="email"
                        defaultValue={user.email}
                        placeholder={t("email")}
                        required
                        className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <select
                        name="locale"
                        defaultValue={user.locale}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="it">Italiano (it)</option>
                        <option value="en">English (en)</option>
                      </select>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        {t("updateUserDetails")}
                      </button>
                    </form>
                    <form
                      action={setUserRole}
                      className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-start sm:gap-3"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        key={`${user.id}-${user.role}`}
                        defaultValue={user.role}
                        className="block h-10 w-full min-w-[160px] rounded-full border border-zinc-200 bg-white px-3 pr-8 text-left text-xs font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:h-9 sm:w-[180px]"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 sm:w-auto sm:px-4 sm:py-2"
                      >
                        {t("updateRole")}
                      </button>
                    </form>
                    <div className="flex flex-col gap-2 text-xs font-semibold sm:flex-row sm:items-center sm:justify-start sm:gap-3">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {user.isActive ? t("statusActive") : t("statusDisabled")}
                      </span>
                      <form action={setUserStatus} className="flex justify-start sm:justify-end">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="active" value={(!user.isActive).toString()} />
                        <button
                          type="submit"
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
                        >
                          {t("toggle")}
                        </button>
                      </form>
                      <form
                        action={deleteUser}
                        className="flex justify-start sm:justify-end"
                        data-confirm={t("deleteConfirm", {
                          defaultValue: "Eliminare definitivamente questo utente?",
                        })}
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                        >
                          Elimina
                        </button>
                      </form>
                      <form
                        action={sendPasswordResetLink}
                        className="flex justify-start sm:justify-end"
                        data-confirm={t("sendResetConfirm", {
                          defaultValue: "Inviare il link di reset password a questo utente?",
                        })}
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button
                          type="submit"
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
                        >
                          {t("sendResetLink")}
                        </button>
                      </form>
                      {user.id !== admin.id ? (
                        <form action={startImpersonation} className="flex justify-start sm:justify-end">
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
                          >
                            Impersona
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{t("createUser")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("usersFormHelper")}</p>
          <form action={upsertUser} className="mt-3 space-y-3 text-sm">
            <input
              name="name"
              placeholder={t("name")}
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="email"
              type="email"
              placeholder={t("email")}
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <select
              name="role"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue={Role.SECRETARY}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              name="locale"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue="it"
            >
              <option value="it">Italiano (it)</option>
              <option value="en">English (en)</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                name="active"
                className="h-4 w-4 rounded border-zinc-300"
                defaultChecked
              />
              {t("active")}
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {t("saveUser")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
