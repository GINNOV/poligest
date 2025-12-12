import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

const roles: Role[] = [Role.ADMIN, Role.MANAGER, Role.SECRETARY, Role.PATIENT];

async function upsertUser(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = formData.get("role") as Role;
  const locale = (formData.get("locale") as string) || "it";
  const isActive = formData.get("active") === "on";

  if (!email || !role || !roles.includes(role)) {
    throw new Error("Dati utente non validi");
  }

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
    },
  });

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

  const admin = await requireUser([Role.ADMIN]);
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

  const admin = await requireUser([Role.ADMIN]);
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

  await requireUser([Role.ADMIN]);
  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Utente non valido");

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/utenti");
}

async function updateUserDetails(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
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

export default async function AdminUsersPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const users = await prisma.user.findMany({
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
      <nav className="text-sm text-zinc-600">
        <Link href="/admin" className="hover:text-emerald-700">
          Amministrazione
        </Link>{" "}
        / <span className="text-zinc-900">{t("users")}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("users")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">{t("usersHeading")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t("usersSubtitle")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-800">
          {users.length} utenti
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">{t("usersList")}</h2>
            <span className="text-xs font-semibold uppercase text-zinc-500">Ruoli &amp; stato</span>
          </div>

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
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

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
