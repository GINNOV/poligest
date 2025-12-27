import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

type ErrorMetadata = {
  message?: string;
  source?: string;
  path?: string;
  context?: Record<string, unknown>;
  error?: { name?: string; message?: string };
};

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

  const normalized = logs.map((log) => {
    const meta = log.metadata as ErrorMetadata | null;
    return {
      id: log.id,
      code: log.entityId ?? log.id,
      message: meta?.message ?? "Errore non specificato",
      source: meta?.source ?? null,
      path: meta?.path ?? null,
      errorMessage: meta?.error?.message ?? null,
      actor: log.user?.name || log.user?.email || null,
      role: log.user?.role ?? null,
      createdAt: log.createdAt,
    };
  });

  const query = q.toLowerCase();
  const filtered = query
    ? normalized.filter((entry) => {
        return (
          entry.code.toLowerCase().includes(query) ||
          entry.message.toLowerCase().includes(query) ||
          (entry.source && entry.source.toLowerCase().includes(query)) ||
          (entry.path && entry.path.toLowerCase().includes(query)) ||
          (entry.errorMessage && entry.errorMessage.toLowerCase().includes(query))
        );
      })
    : normalized;

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Errori</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Registro errori</h1>
          <p className="text-sm text-zinc-600">
            Elenco degli errori applicativi con codice per il supporto.
          </p>
        </div>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
          {filtered.length} errori (max 200)
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[2fr,1fr,auto]" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Codice o messaggio
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Cerca per codice o testo"
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Data
            <input
              type="date"
              name="date"
              defaultValue={dateParam ?? ""}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Applica
            </button>
            <a
              href="/admin/errori"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-rose-200 hover:text-rose-600"
            >
              Reset
            </a>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          {filtered.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun errore trovato con i filtri scelti.</p>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-700">Codice: {entry.code}</p>
                  <p className="text-xs text-zinc-500">{formatDate(entry.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-900">{entry.message}</p>
                {entry.errorMessage ? (
                  <p className="mt-1 text-xs text-rose-700">Dettaglio: {entry.errorMessage}</p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  {entry.source ? `Sorgente: ${entry.source}` : "Sorgente: —"}
                  {" · "}
                  {entry.path ? `Percorso: ${entry.path}` : "Percorso: —"}
                </p>
                {entry.actor ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Utente: {entry.actor}
                    {entry.role ? ` (${entry.role})` : ""}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
