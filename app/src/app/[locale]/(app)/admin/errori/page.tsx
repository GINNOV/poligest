import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { JsonObject } from "@/lib/json-types";
import { Prisma, Role } from "@prisma/client";
import Link from "next/link";
import { ErrorLogCard } from "@/components/admin/error-log-card";
import {
  ERROR_CODE_HELP,
  normalizeErrorLog,
  type ErrorMetadataView,
} from "@/lib/error-registry";

export const metadata = createPageMetadata(PAGE_TITLES.errori);

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);
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

  const filters: Prisma.AuditLogWhereInput[] = [{ action: "error.reported" }];
  if (dateFilter) {
    filters.push({ createdAt: dateFilter });
  }

  const logs = await prisma.auditLog.findMany({
    where: filters.length ? { AND: filters } : undefined,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const normalized = logs.map((log) =>
    normalizeErrorLog({
      id: log.id,
      entityId: log.entityId,
      metadata: log.metadata as ErrorMetadataView | null,
      actor: log.user?.name || log.user?.email || null,
      role: log.user?.role ?? null,
      createdAt: log.createdAt,
    }),
  );

  const formatContext = (context: JsonObject | null) => {
    if (!context) return null;
    try {
      const raw = JSON.stringify(context);
      return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
    } catch {
      return String(context);
    }
  };

  const query = q.toLowerCase();
  const filtered = query
    ? normalized.filter((entry) => {
        return (
          entry.supportCode.toLowerCase().includes(query) ||
          entry.message.toLowerCase().includes(query) ||
          entry.codeKindLabel.toLowerCase().includes(query) ||
          entry.areaLabel.toLowerCase().includes(query) ||
          (entry.source && entry.source.toLowerCase().includes(query)) ||
          (entry.path && entry.path.toLowerCase().includes(query)) ||
          (entry.errorMessage && entry.errorMessage.toLowerCase().includes(query)) ||
          (entry.errorDigest && entry.errorDigest.toLowerCase().includes(query)) ||
          entry.id.toLowerCase().includes(query)
        );
      })
    : normalized;

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));

  async function clearErrors() {
    "use server";

    await requireUser([Role.ADMIN]);
    await prisma.auditLog.deleteMany({ where: { action: "error.reported" } });
    revalidatePath("/admin/errori");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Errori</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registro errori</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Elenco degli errori applicativi con codice per il supporto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
            {filtered.length} errori (max 200)
          </span>
          <form action={clearErrors}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-full border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Trash all errors
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Come leggere i codici</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            <p className="font-semibold">Codice supporto app · ERR-...</p>
            <p className="mt-1 text-xs leading-relaxed">{ERROR_CODE_HELP.support}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">Digest Next.js · numeri lunghi</p>
            <p className="mt-1 text-xs leading-relaxed">{ERROR_CODE_HELP.nextDigest}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[2fr,1fr,auto]" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Codice, area o messaggio
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="ERR-..., digest, API, fetch..."
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-rose-500/50 dark:focus:ring-rose-500/10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Data
            <input
              type="date"
              name="date"
              defaultValue={dateParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-rose-500/50 dark:focus:ring-rose-500/10"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Applica
            </button>
            <Link
              href="/admin/errori"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-rose-200 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-rose-500/50 dark:hover:text-rose-400"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          {filtered.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun errore trovato con i filtri scelti.</p>
          ) : (
            filtered.map((entry) => (
              <ErrorLogCard
                key={entry.id}
                entry={entry}
                formattedDate={formatDate(entry.createdAt)}
                contextPreview={formatContext(entry.context)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}