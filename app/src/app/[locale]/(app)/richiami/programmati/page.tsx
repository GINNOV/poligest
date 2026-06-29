import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { RecallStatus, Role } from "@prisma/client";
import { deleteScheduledRecall, scheduleRecall } from "@/app/[locale]/(app)/richiami/actions";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getNotificationChannelLabels } from "@/lib/recalls/delivery";

const channelBadgeStyles = {
  whatsapp:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  email:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300",
  sms: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300",
} as const;

export const metadata = createPageMetadata(PAGE_TITLES.richiamiProgrammati);

export default async function RichiamiProgrammatiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "agenda");
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
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Richiami in scadenza</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Elenco dei richiami programmati nei prossimi 30 giorni.
          </p>
        </div>
        <Link
          href="/richiami"
          className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700"
        >
          Torna alle sezioni
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form method="get" action="/richiami/programmati" className="flex items-center gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query ?? ""}
                placeholder="Cerca paziente, regola, note..."
                className="h-10 w-64 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-4 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
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
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700"
                >
                  Reset
                </Link>
              ) : null}
            </form>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {recalls.length} in coda
            </span>
          </div>
        </div>

        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {recalls.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun richiamo imminente.</p>
          ) : (
            recalls.map((recall) => {
              const channelLabels = getNotificationChannelLabels(recall.rule.channel);
              const overdue = recall.dueAt < now;
              const statusLabel =
                recall.status === RecallStatus.CONTACTED
                  ? "Consegnato"
                  : recall.status === RecallStatus.SKIPPED
                    ? "Problema"
                    : "Programmato";
              const statusClasses =
                recall.status === RecallStatus.CONTACTED
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40"
                  : recall.status === RecallStatus.SKIPPED
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40";
              return (
                <div
                  key={recall.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {recall.patient.lastName} {recall.patient.firstName}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {recall.rule.name} ·{" "}
                      {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
                        recall.dueAt
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                        Canale:
                      </span>
                      {channelLabels.map((channel) => (
                        <span
                          key={channel.key}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${channelBadgeStyles[channel.key]}`}
                        >
                          {channel.label}
                        </span>
                      ))}
                    </div>
                    {recall.notes ? (
                      <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{recall.notes}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {overdue && recall.status === RecallStatus.PENDING ? (
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
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
                          className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-rose-200 dark:hover:border-rose-800 hover:text-rose-700"
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

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Programma richiamo</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Crea un singolo richiamo con data di invio. Non avvia una sequenza ricorrente.
          </p>
        </div>
        <form action={scheduleRecall} className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Paziente</span>
            <select
              name="patientId"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
            >
              <option value="" disabled className="dark:bg-zinc-950">
                Seleziona paziente
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-zinc-950">
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Regola</span>
            <select
              name="ruleId"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
            >
              <option value="" disabled className="dark:bg-zinc-950">
                Seleziona regola
              </option>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id} className="dark:bg-zinc-950">
                  {rule.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Data invio</span>
            <input
              name="dueAt"
              type="datetime-local"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
            />
          </label>
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Note</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
            ></textarea>
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