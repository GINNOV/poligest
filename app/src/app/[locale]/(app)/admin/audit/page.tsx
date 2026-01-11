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

  const dateParam =
    typeof params.date === "string"
      ? params.date
      : Array.isArray(params.date)
        ? params.date[0]
        : undefined;

  let dateFilter:
    | {
        gte: Date;
        lt: Date;
      }
    | undefined;

  if (dateParam && !Number.isNaN(Date.parse(dateParam))) {
    const start = new Date(dateParam);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    dateFilter = { gte: start, lt: end };
  }

  const filters: Prisma.AuditLogWhereInput[] = [];
  if (q) {
    filters.push({
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
    });
  }
  if (dateFilter) {
    filters.push({ createdAt: dateFilter });
  }

  const logs = await prisma.auditLog.findMany({
    where: filters.length ? { AND: filters } : undefined,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);

  const formatDay = (date: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);

  const actionEmoji = (action: string) => {
    const map: Record<string, string> = {
      "sms.sent": "📩",
      "appointment.created": "📅",
      "appointment.updated": "✏️",
      "appointment.deleted": "🗑️",
      "appointment.status_updated": "🔄",
      "patient.created": "🧑‍⚕️",
      "patient.updated": "🩺",
      "consent.added": "✅",
      "consent.revoked": "⛔",
      "gdpr.exported": "📥",
      "gdpr.erased": "🧨",
      "gdpr.retention.cleaned": "🧹",
      "inventory.movement": "📦",
      "user.login": "🔑",
      "user.updated": "👤",
    };
    return map[action] ?? "ℹ️";
  };

  const groupedByDay = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    const key = log.createdAt.toISOString().split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
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
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[2fr,1fr,auto]" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            {t("auditSearchLabel")}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t("auditSearchPlaceholder")}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Data
            <input
              type="date"
              name="date"
              defaultValue={dateParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex items-end gap-2">
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

        <div className="mt-6 space-y-6">
          {logs.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">{t("auditEmpty")}</p>
          ) : (
            Object.entries(groupedByDay)
              .sort(([a], [b]) => (a > b ? -1 : 1))
              .map(([dayKey, dayLogs]) => (
                <div key={dayKey} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-zinc-200" />
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase text-zinc-700">
                      {formatDay(new Date(dayKey))}
                    </div>
                    <div className="h-px flex-1 bg-zinc-200" />
                  </div>

                  <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    {dayLogs.map((log) => {
                      const actor =
                        log.user?.name ||
                        log.user?.email ||
                        t("auditUnknownUser");
                      return (
                        <div key={log.id} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.2fr,0.8fr]">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                                <span>{actionEmoji(log.action)}</span>
                                {log.action}
                              </span>
                              <span className="text-xs font-semibold text-zinc-600">
                                by user: {actor} · {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-800">&nbsp;</p>
                          </div>
                          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900">Dettagli tecnici</span>
                              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                                {log.user?.role ?? "—"}
                              </span>
                            </div>
                            <div className="mt-1 space-y-1">
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800">Entità:</span>
                                <span className="text-zinc-700">
                                  {log.entity}
                                  {log.entityId ? ` · ${log.entityId}` : ""}
                                </span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800">Utente:</span>
                                <span className="text-zinc-700">{log.user?.email ?? "—"}</span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800">IP:</span>
                                <span className="text-zinc-700">{log.ip ?? "—"}</span>
                              </div>
                            </div>
                            {log.metadata ? (
                              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-[11px] text-zinc-700">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
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
