import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess, getRoleFeatureAccess } from "@/lib/feature-access";
import { RecallStatus, Role } from "@prisma/client";
import { deleteScheduledRecall, scheduleRecall, markRecallAsContacted } from "@/app/[locale]/(app)/richiami/actions";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getNotificationChannelLabels } from "@/lib/recalls/delivery";
import { normalizeItalianPhone } from "@/lib/phone";
import { buildRecallDeliveryPlan } from "@/lib/recalls/send-domain";
import { getAllEmailTemplates } from "@/lib/email-templates";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { RecallWhatsappButton } from "@/components/recall-whatsapp-button";

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
  const { isAllowed } = await getRoleFeatureAccess(user.role);
  const showPatientLink = isAllowed("patients");
  const params = await searchParams;

  // Extract query filters
  const qParam = params.q;
  const qValue =
    typeof qParam === "string"
      ? qParam.trim()
      : Array.isArray(qParam)
        ? qParam[0]?.trim()
        : "";
  const query = qValue || undefined;

  const statusParam = params.status as string | undefined;
  const ruleIdParam = params.ruleId as string | undefined;
  const fromParam = params.from as string | undefined;
  const toParam = params.to as string | undefined;
  const pageParam = params.page as string | undefined;

  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const limit = 12; // 12 cards per page

  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const todayStr = now.toISOString().split("T")[0];
  const soonStr = soon.toISOString().split("T")[0];

  // Build Prisma where clause
  const whereClause: any = {
    AND: []
  };

  // 1. Status Filter
  if (statusParam && statusParam !== "ALL") {
    whereClause.AND.push({ status: statusParam as RecallStatus });
  } else {
    whereClause.AND.push({ status: { in: [RecallStatus.PENDING, RecallStatus.CONTACTED, RecallStatus.SKIPPED] } });
  }

  // 2. Rule Filter
  if (ruleIdParam) {
    whereClause.AND.push({ ruleId: ruleIdParam });
  }

  // 3. Calendar Date Filters
  if (fromParam) {
    whereClause.AND.push({ dueAt: { gte: new Date(fromParam) } });
  } else {
    // If not specified, default to today
    whereClause.AND.push({ dueAt: { gte: new Date(todayStr) } });
  }

  if (toParam) {
    whereClause.AND.push({ dueAt: { lte: new Date(toParam + "T23:59:59.999Z") } });
  } else {
    // If not specified, default to 30 days from now
    whereClause.AND.push({ dueAt: { lte: new Date(soonStr + "T23:59:59.999Z") } });
  }

  // 4. Text search
  if (query) {
    whereClause.AND.push({
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
    });
  }

  const [totalRecalls, recalls, rules, patients, emailTemplates] = await Promise.all([
    prisma.recall.count({ where: whereClause }),
    prisma.recall.findMany({
      where: whereClause,
      orderBy: { dueAt: "asc" },
      include: { patient: true, rule: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    getAllEmailTemplates(),
  ]);

  const totalPages = Math.ceil(totalRecalls / limit);

  const patientSearchOptions = patients.map((p) => {
    const notesLines = (p.notes ?? "").split("\n");
    const taxIdLine = notesLines.find((line) => line.startsWith("Codice Fiscale:"));
    const parsedTaxId = taxIdLine?.replace("Codice Fiscale:", "").trim() ?? "";
    return {
      id: p.id,
      fullName: `${p.lastName} ${p.firstName}`.trim(),
      phone: p.phone,
      taxId: parsedTaxId,
    };
  });

  // Group the page's recalls by month
  const groupedRecalls: { month: string; items: typeof recalls }[] = [];
  for (const recall of recalls) {
    const monthKey = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(recall.dueAt);
    const capitalizedMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
    let group = groupedRecalls.find((g) => g.month === capitalizedMonth);
    if (!group) {
      group = { month: capitalizedMonth, items: [] };
      groupedRecalls.push(group);
    }
    group.items.push(recall);
  }

  const buildPageUrl = (pageNum: number) => {
    const paramsObj = new URLSearchParams();
    if (qValue) paramsObj.set("q", qValue);
    if (statusParam) paramsObj.set("status", statusParam);
    if (ruleIdParam) paramsObj.set("ruleId", ruleIdParam);
    if (fromParam) paramsObj.set("from", fromParam);
    if (toParam) paramsObj.set("to", toParam);
    paramsObj.set("page", String(pageNum));
    return `/richiami/programmati?${paramsObj.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Richiami in scadenza</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Elenco dei richiami programmati filtrati per data, regola e stato.
          </p>
        </div>
        <Link
          href="/richiami"
          className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700"
        >
          Torna alle sezioni
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm space-y-6">
        {/* Filters Form */}
        <form method="get" action="/richiami/programmati" className="space-y-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 p-4 border border-zinc-100 dark:border-zinc-900/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Cerca</span>
              <input
                type="search"
                name="q"
                defaultValue={qValue}
                placeholder="Paziente, regola..."
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Stato</span>
              <select
                name="status"
                defaultValue={statusParam || "ALL"}
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
              >
                <option value="ALL">Tutti gli stati</option>
                <option value="PENDING">Programmato</option>
                <option value="CONTACTED">Consegnato</option>
                <option value="SKIPPED">Problema</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Regola</span>
              <select
                name="ruleId"
                defaultValue={ruleIdParam || ""}
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
              >
                <option value="">Tutte le regole</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Dal (data invio)</span>
              <input
                type="date"
                name="from"
                defaultValue={fromParam || ""}
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Al (data invio)</span>
              <input
                type="date"
                name="to"
                defaultValue={toParam || ""}
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {totalRecalls} richiami trovati
            </span>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-5 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Applica filtri
              </button>
              {(qValue || statusParam || ruleIdParam || fromParam || toParam) ? (
                <Link
                  href="/richiami/programmati"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700"
                >
                  Resetta filtri
                </Link>
              ) : null}
            </div>
          </div>
        </form>

        {/* Grouped Cards list */}
        <div className="space-y-8">
          {groupedRecalls.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun richiamo programmato trovato con i filtri selezionati.</p>
          ) : (
            groupedRecalls.map((group) => (
              <div key={group.month} className="space-y-4">
                <h2 className="text-base font-bold text-zinc-850 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-850 pb-2">
                  {group.month}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((recall) => {
                    const channelLabels = getNotificationChannelLabels(recall.rule.channel);
                    const overdue = recall.dueAt < now;
                    const statusLabel =
                      recall.status === RecallStatus.CONTACTED
                        ? "Avvisato"
                        : recall.status === RecallStatus.SKIPPED
                          ? "Problema"
                          : "Programmato";
                    const statusClasses =
                      recall.status === RecallStatus.CONTACTED
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40"
                        : recall.status === RecallStatus.SKIPPED
                          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40";
                    const patientPhone = normalizeItalianPhone(recall.patient.phone);
                    const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
                    const template = recall.rule.templateName
                      ? emailTemplates.find((t) => t.name === recall.rule.templateName)
                      : null;
                    const plan = buildRecallDeliveryPlan({
                      patient: recall.patient,
                      rule: recall.rule,
                      template,
                    });
                    const whatsappMessage = plan.body;
                    const whatsappHref = whatsappPhone
                      ? `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}`
                      : null;

                    return (
                      <div
                        key={recall.id}
                        className={`rounded-xl border p-5 shadow-sm flex flex-col justify-between transition ${
                          recall.status === RecallStatus.CONTACTED
                            ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-300 dark:hover:border-emerald-800"
                            : recall.status === RecallStatus.SKIPPED
                              ? "border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 hover:border-rose-300 dark:hover:border-rose-800"
                              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-emerald-200 dark:hover:border-emerald-800"
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                {recall.patient.lastName} {recall.patient.firstName}
                              </h3>
                              {recall.patient.phone ? (
                                <p className="text-xs text-zinc-650 dark:text-zinc-400 font-medium">
                                  Tel: {recall.patient.phone}
                                </p>
                              ) : null}
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                In data: {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(recall.dueAt)}
                              </p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses}`}>
                              {statusLabel}
                            </span>
                          </div>

                          <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-2 space-y-1.5">
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              Regola: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{recall.rule.name}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Canale:</span>
                              {channelLabels.map((channel) => (
                                <span
                                  key={channel.key}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${channelBadgeStyles[channel.key]}`}
                                >
                                  {channel.label}
                                </span>
                              ))}
                            </div>
                          </div>

                          {recall.notes ? (
                            <div className="bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 italic">
                              {recall.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                          <div>
                            {overdue && recall.status === RecallStatus.PENDING ? (
                              <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                In ritardo
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {showPatientLink ? (
                              <Link
                                href={`/pazienti/${recall.patient.id}`}
                                className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700"
                              >
                                Scheda
                              </Link>
                            ) : null}

                            {recall.status === RecallStatus.PENDING ? (
                              whatsappHref ? (
                                <RecallWhatsappButton
                                  recallId={recall.id}
                                  whatsappHref={whatsappHref}
                                  action={markRecallAsContacted}
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700/60 opacity-70 px-2.5 py-1 text-[11px] font-semibold text-white cursor-not-allowed shrink-0">
                                  <Image src="/whatsapp.png" alt="" width={12} height={12} className="shrink-0 brightness-0 invert" />
                                  <span>Invia</span>
                                </span>
                              )
                            ) : null}

                            {recall.status === RecallStatus.PENDING ? (
                              <form
                                action={deleteScheduledRecall}
                                data-confirm="Rimuovere questo richiamo programmato?"
                              >
                                <input type="hidden" name="recallId" value={recall.id} />
                                <button
                                  type="submit"
                                  className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-rose-200 dark:hover:border-rose-800 hover:text-rose-700"
                                >
                                  Rimuovi
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800 px-4 py-3 sm:px-6 mt-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Link
                href={buildPageUrl(page - 1)}
                className={`relative inline-flex items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                Precedente
              </Link>
              <Link
                href={buildPageUrl(page + 1)}
                className={`relative ml-3 inline-flex items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                Successivo
              </Link>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-400">
                  Mostrando da <span className="font-medium">{(page - 1) * limit + 1}</span> a{" "}
                  <span className="font-medium">{Math.min(page * limit, totalRecalls)}</span> di{" "}
                  <span className="font-medium">{totalRecalls}</span> risultati
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <Link
                    href={buildPageUrl(page - 1)}
                    className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-zinc-400 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:z-20 focus:outline-offset-0 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="sr-only">Precedente</span>
                    &larr;
                  </Link>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isCurrent = pageNum === page;
                    return (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(pageNum)}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`relative z-10 inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          isCurrent
                            ? "bg-emerald-700 text-white focus-visible:outline-emerald-600"
                            : "text-zinc-900 dark:text-zinc-100 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}

                  <Link
                    href={buildPageUrl(page + 1)}
                    className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-zinc-400 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:z-20 focus:outline-offset-0 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="sr-only">Successivo</span>
                    &rarr;
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        ) : null}
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
            <PatientSearchCombobox
              name="patientId"
              patients={patientSearchOptions}
              placeholder="Cerca paziente..."
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/20"
            />
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