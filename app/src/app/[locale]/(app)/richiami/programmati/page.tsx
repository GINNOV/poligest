import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { RecallStatus, Role } from "@prisma/client";
import { deleteScheduledRecall, scheduleRecall } from "@/app/[locale]/(app)/richiami/actions";

export default async function RichiamiProgrammatiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const params = await searchParams;
  const qParam = params.q;
  const qValue =
    typeof qParam === "string"
      ? qParam.trim()
      : Array.isArray(qParam)
        ? qParam[0]?.trim()
        : "";
  const query = qValue || undefined;
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [recalls, rules, patients] = await Promise.all([
    prisma.recall.findMany({
      where: {
        AND: [
          { status: { in: [RecallStatus.PENDING, RecallStatus.CONTACTED, RecallStatus.SKIPPED] } },
          { dueAt: { lte: soon } },
          query
            ? {
                OR: [
                  {
                    patient: {
                      OR: [
                        { firstName: { contains: query, mode: "insensitive" } },
                        { lastName: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } },
                        { phone: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                  { notes: { contains: query, mode: "insensitive" } },
                  { rule: { name: { contains: query, mode: "insensitive" } } },
                  { rule: { serviceType: { contains: query, mode: "insensitive" } } },
                ],
              }
            : {},
        ],
      },
      orderBy: { dueAt: "asc" },
      include: { patient: true, rule: true },
      take: 50,
    }),
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Richiami in scadenza</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Elenco dei richiami programmati nei prossimi 30 giorni.
          </p>
        </div>
        <Link
          href="/richiami"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Torna alle sezioni
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form method="get" action="/richiami/programmati" className="flex items-center gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query ?? ""}
                placeholder="Cerca paziente, regola, note..."
                className="h-10 w-64 rounded-full border border-zinc-200 px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Cerca
              </button>
              {query ? (
                <Link
                  href="/richiami/programmati"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  Reset
                </Link>
              ) : null}
            </form>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {recalls.length} in coda
            </span>
          </div>
        </div>

        <div className="mt-4 divide-y divide-zinc-100">
          {recalls.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun richiamo imminente.</p>
          ) : (
            recalls.map((recall) => {
              const overdue = recall.dueAt < now;
              const statusLabel =
                recall.status === RecallStatus.CONTACTED
                  ? "Consegnato"
                  : recall.status === RecallStatus.SKIPPED
                    ? "Problema"
                    : "Programmato";
              const statusClasses =
                recall.status === RecallStatus.CONTACTED
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : recall.status === RecallStatus.SKIPPED
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200";
              return (
                <div
                  key={recall.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {recall.patient.lastName} {recall.patient.firstName}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {recall.rule.name} ·{" "}
                      {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
                        recall.dueAt
                      )}
                    </p>
                    {recall.notes ? (
                      <span className="text-xs text-zinc-500">{recall.notes}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {overdue && recall.status === RecallStatus.PENDING ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        In ritardo
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}
                    >
                      {statusLabel}
                    </span>
                    {recall.status === RecallStatus.PENDING ? (
                      <form
                        action={deleteScheduledRecall}
                        data-confirm="Rimuovere questo richiamo programmato?"
                      >
                        <input type="hidden" name="recallId" value={recall.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-rose-200 hover:text-rose-700"
                        >
                          Rimuovi
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Programma richiamo manuale</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Crea un singolo richiamo con data di invio. Non avvia una sequenza ricorrente.
          </p>
        </div>
        <form action={scheduleRecall} className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Paziente</span>
            <select
              name="patientId"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="" disabled>
                Seleziona paziente
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Regola</span>
            <select
              name="ruleId"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="" disabled>
                Seleziona regola
              </option>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Data invio</span>
            <input
              name="dueAt"
              type="datetime-local"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-semibold uppercase text-zinc-500">Note</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
          >
            Programma richiamo
          </button>
        </form>
      </div>
    </div>
  );
}
