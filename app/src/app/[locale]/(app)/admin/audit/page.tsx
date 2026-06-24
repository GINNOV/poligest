import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import Link from "next/link";
import { AuditRecordNav } from "@/components/admin/AuditRecordNav";

export const metadata = createPageMetadata(PAGE_TITLES.audit);

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);
  const { locale } = await params;
  const t = await getTranslations("admin");
  const searchParamsValue = await searchParams;

  const q =
    typeof searchParamsValue.q === "string"
      ? searchParamsValue.q.trim()
      : Array.isArray(searchParamsValue.q)
        ? searchParamsValue.q[0]?.trim()
        : "";

  const dateParam =
    typeof searchParamsValue.date === "string"
      ? searchParamsValue.date
      : Array.isArray(searchParamsValue.date)
        ? searchParamsValue.date[0]
        : undefined;

  const userIdParam =
    typeof searchParamsValue.userId === "string"
      ? searchParamsValue.userId
      : Array.isArray(searchParamsValue.userId)
        ? searchParamsValue.userId[0]
        : undefined;

  const roleParam =
    typeof searchParamsValue.role === "string"
      ? searchParamsValue.role
      : Array.isArray(searchParamsValue.role)
        ? searchParamsValue.role[0]
        : undefined;

  const uq =
    typeof searchParamsValue.uq === "string"
      ? searchParamsValue.uq.trim()
      : Array.isArray(searchParamsValue.uq)
        ? searchParamsValue.uq[0]?.trim()
        : "";

  const typeParam =
    typeof searchParamsValue.type === "string"
      ? searchParamsValue.type
      : Array.isArray(searchParamsValue.type)
        ? searchParamsValue.type[0]
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
  if (userIdParam) {
    filters.push({ userId: userIdParam });
  }
  if (roleParam) {
    filters.push({
      user: {
        role: roleParam as Role,
      },
    });
  }
  if (uq) {
    filters.push({
      user: {
        OR: [
          { email: { contains: uq, mode: Prisma.QueryMode.insensitive } },
          { name: { contains: uq, mode: Prisma.QueryMode.insensitive } },
        ],
      },
    });
  }
  if (typeParam) {
    filters.push({ action: typeParam });
  }

  const [logs, users, actionTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where: filters.length ? { AND: filters } : undefined,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

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
      "error.reported": "🚨",
    };
    return map[action] ?? "ℹ️";
  };

  const renderMetadata = (metadata: Prisma.JsonValue, logId: string) => {
    if (!metadata) return null;
    const metadataString = JSON.stringify(metadata, null, 2);
    const lineCount = metadataString.split("\n").length;

    // Check if metadata contains a base64 image (specifically for consent signatures or photos)
    let base64Image: string | null = null;
    if (typeof metadata === "object" && metadata !== null) {
      const meta = metadata as Record<string, unknown>;
      // Common fields for images in our system
      const imageValue = meta.signature || meta.photo || meta.imageData || meta.image;
      if (typeof imageValue === "string" && imageValue.startsWith("data:image/")) {
        base64Image = imageValue;
      }
    }

    return (
      <>
        {base64Image && (
          <div className="mt-2 mb-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 inline-block">
            <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Immagine acquisita:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={base64Image} alt="Audit attachment" className="max-h-48 rounded shadow-sm" />
          </div>
        )}
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white dark:bg-zinc-950 px-3 py-2 text-[11px] text-zinc-700 dark:text-zinc-300">
          {metadataString}
        </pre>
        {lineCount > 50 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300">
            <span>Prossimo record</span>
            <AuditRecordNav containerId={`log-${logId}`} showLabels={false} />
          </div>
        )}
      </>
    );
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
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t("auditTitle")}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("auditSubtitle")}</p>
        </div>
        <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {logs.length} eventi (max 200)
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.5fr,1fr,1.5fr,1fr,1.5fr,1fr,auto]" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("auditSearchLabel")}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t("auditSearchPlaceholder")}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Data
            <input
              type="date"
              name="date"
              defaultValue={dateParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Cerca utente
            <input
              type="text"
              name="uq"
              defaultValue={uq}
              placeholder="Nome o email"
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Ruolo utente
            <select
              name="role"
              defaultValue={roleParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            >
              <option value="">Tutti</option>
              {Object.values(Role).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Utente
            <select
              name="userId"
              defaultValue={userIdParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            >
              <option value="">Tutti</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Tipo
            <select
              name="type"
              defaultValue={typeParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10"
            >
              <option value="">Tutti</option>
              {actionTypes.map((at) => (
                <option key={at.action} value={at.action}>
                  {at.action}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              aria-label={t("auditApplyFilters")}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {t("apply")}
            </button>
            <Link
              href="/admin/audit"
              aria-label={t("auditResetFilters")}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-500"
            >
              {t("resetFilters")}
            </Link>
          </div>
        </form>

        <div className="mt-6 space-y-6">
          {logs.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">{t("auditEmpty")}</p>
          ) : (
            Object.entries(groupedByDay)
              .sort(([a], [b]) => (a > b ? -1 : 1))
              .map(([dayKey, dayLogs]) => (
                <div key={dayKey} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase text-zinc-700 dark:text-zinc-300">
                      {formatDay(new Date(dayKey))}
                    </div>
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
                    {dayLogs.map((log) => {
                      const actor =
                        log.user?.name ||
                        log.user?.email ||
                        t("auditUnknownUser");

                      const isErrorReported = log.action === "error.reported";

                      // Extract patientId and quoteId for linking
                      const entityLower = log.entity.toLowerCase();
                      let patientId = entityLower === "patient" ? log.entityId : null;
                      let quoteId = entityLower === "quote" ? log.entityId : null;
                      let appointmentId = entityLower === "appointment" ? log.entityId : null;
                      let quoteItemId = null;

                      if (log.metadata && typeof log.metadata === "object") {
                        const meta = log.metadata as Record<string, unknown>;
                        if (!patientId && meta.patientId) patientId = meta.patientId as string;
                        if (!patientId && meta.patient_id) patientId = meta.patient_id as string;
                        if (!quoteId && meta.quoteId) quoteId = meta.quoteId as string;
                        if (!quoteId && meta.quote_id) quoteId = meta.quote_id as string;
                        if (!appointmentId && meta.appointmentId) appointmentId = meta.appointmentId as string;
                        if (!appointmentId && meta.appointment_id) appointmentId = meta.appointment_id as string;
                        if (meta.quoteItemId) quoteItemId = meta.quoteItemId as string;
                        if (meta.quote_item_id) quoteItemId = meta.quote_item_id as string;
                      }

                      return (
                        <div
                          key={log.id}
                          id={`log-${log.id}`}
                          className="audit-record grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.2fr,0.8fr]"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                                    isErrorReported
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                  }`}
                                >
                                  <span>{actionEmoji(log.action)}</span>
                                  {log.action}
                                </span>
                                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                  by user: {actor} · {formatDate(log.createdAt)}
                                </span>
                              </div>
                              <div className="shrink-0">
                                <AuditRecordNav containerId={`log-${log.id}`} />
                              </div>
                            </div>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200">&nbsp;</p>
                          </div>
                          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Dettagli tecnici</span>
                              <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                                {log.user?.role ?? "—"}
                              </span>
                            </div>
                            <div className="mt-1 space-y-1">
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Entità:</span>
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  {log.entity}
                                  {log.entityId ? ` · ${log.entityId}` : ""}
                                </span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Utente:</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{log.user?.email ?? "—"}</span>
                              </div>
                              <div className="flex items-start gap-1">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">IP:</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{log.ip ?? "—"}</span>
                              </div>
                              {patientId && (
                                <div className="mt-2">
                                  <Link
                                    href={`/${locale}/pazienti/${patientId}/scheda`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                                  >
                                    👤 Vedi Paziente
                                  </Link>
                                </div>
                              )}
                              {quoteId && patientId && (
                                <div className="mt-1">
                                  <Link
                                    href={`/${locale}/pazienti/${patientId}/preventivo/${quoteId}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                                  >
                                    📄 Vedi Preventivo
                                  </Link>
                                </div>
                              )}
                              {quoteItemId && !quoteId && (
                                <div className="mt-1">
                                  <Link
                                    href={`/${locale}/finanza/pagamenti?q=${quoteItemId}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                                  >
                                    🔍 Cerca Voce Preventivo
                                  </Link>
                                </div>
                              )}
                              {appointmentId && (
                                <div className="mt-1">
                                  <Link
                                    href={`/${locale}/agenda/appuntamenti?q=${appointmentId}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                                  >
                                    📅 Vedi Appuntamento
                                  </Link>
                                </div>
                              )}
                            </div>
                            {renderMetadata(log.metadata, log.id)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{t("auditLimitHint")}</p>
      </div>
    </div>
  );
}
