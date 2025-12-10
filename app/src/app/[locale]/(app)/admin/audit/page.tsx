import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");
  const params = await searchParams;

  const q =
    typeof params.q === "string"
      ? params.q.trim()
      : Array.isArray(params.q)
        ? params.q[0]?.trim()
        : "";

  const where = q
    ? {
        OR: [
          { action: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { entity: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { entityId: { contains: q, mode: Prisma.QueryMode.insensitive } },
          {
            user: {
              OR: [
                { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          },
        ],
      }
    : undefined;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-zinc-600">
        <Link href="/admin" className="hover:text-emerald-700">
          Amministrazione
        </Link>{" "}
        / <span className="text-zinc-900">{t("audit")}</span>
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("audit")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">{t("auditTitle")}</h1>
          <p className="text-sm text-zinc-600">{t("auditSubtitle")}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {logs.length} eventi (max 200)
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3" method="get">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-zinc-800">
            {t("auditSearchLabel")}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t("auditSearchPlaceholder")}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              aria-label={t("auditApplyFilters")}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {t("apply")}
            </button>
            <a
              href="/admin/audit"
              aria-label={t("auditResetFilters")}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              {t("resetFilters")}
            </a>
          </div>
        </form>

        <div className="mt-4 divide-y divide-zinc-100">
          {logs.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">{t("auditEmpty")}</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      {log.action}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                      {log.entity}
                      {log.entityId ? ` · ${log.entityId}` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">
                    {formatDate(log.createdAt)} ·{" "}
                    {log.user
                      ? `${log.user.name ?? log.user.email} (${log.user.email ?? "—"})`
                      : t("auditUnknownUser")}
                  </p>
                  {log.metadata ? (
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                  <div className="font-semibold text-zinc-900">{t("auditDetails")}</div>
                  <div className="mt-1 space-y-1">
                    <div>
                      <span className="font-semibold text-zinc-800">{t("auditFieldUser")}:</span>{" "}
                      {log.user?.email ?? "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-800">{t("auditFieldRole")}:</span>{" "}
                      {log.user?.role ?? "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-800">{t("auditFieldIp")}:</span>{" "}
                      {log.ip ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("auditLimitHint")}</p>
      </div>
    </div>
  );
}
