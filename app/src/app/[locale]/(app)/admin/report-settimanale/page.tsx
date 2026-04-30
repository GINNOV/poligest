import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel, isMissingPrismaModelError, runOptionalPrismaQuery } from "@/lib/prisma-models";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import {
  REPORT_CONFIG_ID,
  getCurrentPracticeWeekPeriod,
  parseRecipientEmails,
  sendPracticeWeeklyReport,
} from "@/lib/practice-weekly-report";
import { Role } from "@prisma/client";

const formatDateTime = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Rome",
      }).format(value)
    : "—";

async function saveWeeklyReportConfig(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const configClient = getOptionalPrismaModel<{
    upsert?: (args: {
      where: { id: string };
      update: { enabled: boolean; recipientEmails: string };
      create: { id: string; enabled: boolean; recipientEmails: string };
    }) => Promise<unknown>;
  }>("practiceWeeklyReportConfig");
  const enabled = formData.get("enabled") === "on";
  const recipientEmails = (formData.get("recipientEmails") as string | null)?.trim() ?? "";
  const recipients = parseRecipientEmails(recipientEmails);

  if (!configClient?.upsert) {
    throw new Error("Il modulo report settimanale non è disponibile nel server attivo.");
  }

  if (enabled && recipients.length === 0) {
    throw new Error("Inserisci almeno un'email valida per attivare il report.");
  }

  await configClient.upsert({
    where: { id: REPORT_CONFIG_ID },
    update: {
      enabled,
      recipientEmails,
    },
    create: {
      id: REPORT_CONFIG_ID,
      enabled,
      recipientEmails,
    },
  }).catch((error: unknown) => {
    if (isMissingPrismaModelError(error)) {
      throw new Error("Il modulo report settimanale non è disponibile nel server attivo.");
    }

    throw error;
  });

  await logAudit(admin, {
    action: "practice.weekly_report_config_updated",
    entity: "System",
    entityId: REPORT_CONFIG_ID,
    metadata: {
      enabled,
      recipientCount: recipients.length,
    },
  });

  revalidatePath("/admin/report-settimanale");
}

async function sendWeeklyReportNow() {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const result = await sendPracticeWeeklyReport({
    force: true,
    trigger: "MANUAL",
    actor: admin,
  });

  if (result.status === "skipped") {
    if (result.reason === "no_recipients") {
      throw new Error("Configura almeno un destinatario prima di inviare il report.");
    }
    if (result.reason === "disabled") {
      throw new Error("Attiva il report settimanale prima dell'invio manuale.");
    }
  }

  revalidatePath("/admin/report-settimanale");
}

async function clearWeeklyReportHistory() {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const logClient = getOptionalPrismaModel<{
    deleteMany?: (args: Record<string, unknown>) => Promise<unknown>;
  }>("practiceWeeklyReportLog");

  if (!logClient?.deleteMany) {
    throw new Error("Il modulo report settimanale non è disponibile nel server attivo.");
  }

  await logClient.deleteMany({});

  await logAudit(admin, {
    action: "practice.weekly_report_history_cleared",
    entity: "System",
    entityId: REPORT_CONFIG_ID,
  });

  revalidatePath("/admin/report-settimanale");
}

export default async function AdminWeeklyReportPage() {
  try {
    await requireUser([Role.ADMIN]);
    const configClient = getOptionalPrismaModel<{
      findUnique?: (args: { where: { id: string } }) => Promise<{
        enabled: boolean;
        recipientEmails: string;
      } | null>;
    }>("practiceWeeklyReportConfig");
    const logClient = getOptionalPrismaModel<{
      findMany?: (args: {
        orderBy: { createdAt: "asc" | "desc" };
        take: number;
      }) => Promise<Array<{
        id: string;
        periodStart: Date;
        periodEnd: Date;
        status: string;
        trigger: string;
        recipientCount: number;
        sentAt: Date | null;
        error: string | null;
        createdAt: Date;
      }>>;
    }>("practiceWeeklyReportLog");

    const [configResult, logResult] = await Promise.all([
      runOptionalPrismaQuery(
        configClient?.findUnique ? () => configClient.findUnique!({ where: { id: REPORT_CONFIG_ID } }) : undefined,
        null,
      ),
      runOptionalPrismaQuery(
        logClient?.findMany
          ? () =>
              logClient.findMany!({
                orderBy: { createdAt: "desc" },
                take: 8,
              })
          : undefined,
        [],
      ),
    ]);
    const config = configResult.value;
    const recentLogs = logResult.value;
    const weeklyReportAvailable = configResult.available && logResult.available;

    const recipients = parseRecipientEmails(config?.recipientEmails ?? "");
    
    // Default preview to current week if looking at the admin page,
    // as it is usually what users want to "check" manually.
    const nextPeriod = getCurrentPracticeWeekPeriod();

    const nextPreviewHref = `/admin/report-settimanale/preview?start=${encodeURIComponent(nextPeriod.start.toISOString())}&endExclusive=${encodeURIComponent(nextPeriod.endExclusive.toISOString())}`;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Reportistica automatica
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Report settimanale studio</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Ogni report riepiloga visite completate per medico, promemoria inviati, nuovi pazienti,
            incassi registrati e altri indicatori utili a mostrare il valore operativo dell&apos;app.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="pg-card-base">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Configurazione destinatari</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Inserisci una o piu email, separate da virgola o una per riga.
                </p>
              </div>
              <span
                className={`pg-badge-base ${config?.enabled ? "pg-badge-emerald" : "pg-badge-zinc"}`}
              >
                {config?.enabled ? "Attivo" : "Disattivo"}
              </span>
            </div>

            <form action={saveWeeklyReportConfig} className="mt-5 space-y-4">
              <label className="pg-card-flat flex items-center gap-3 px-4 py-3 text-sm font-medium">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={config?.enabled ?? false}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
                Abilita l&apos;invio automatico del report settimanale
              </label>

              <div className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                <p className="font-semibold text-zinc-900 dark:text-zinc-200">Programmazione</p>
                <p className="mt-1">
                  Se abilitato, il report viene inviato automaticamente ogni **Sabato pomeriggio alle 14:00**. 
                  Il report copre l&apos;attività della settimana in corso (Lunedì - Domenica).
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Lista email
                <textarea
                  name="recipientEmails"
                  defaultValue={config?.recipientEmails ?? ""}
                  rows={8}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-950/50 min-h-[120px]"
                  placeholder={"studio@example.com\nmanager@example.com"}
                />
              </label>

              <div className="pg-card-flat flex items-center justify-between px-4 py-3 text-xs">
                <span>Destinatari validi rilevati: <span className="font-semibold">{recipients.length}</span></span>
                {config?.enabled && (
                   <span className="text-zinc-500 dark:text-zinc-400 italic">
                     Prossimo invio automatico: Sabato ore 14:00
                   </span>
                )}
              </div>

              <Button
                type="submit"
                disabled={!weeklyReportAvailable}
              >
                Salva configurazione
              </Button>
            </form>
            {!weeklyReportAvailable ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                Il modulo report settimanale non è disponibile nel server attivo.
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="pg-card-base">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invio manuale</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Il prossimo invio copre il periodo <span className="font-semibold text-zinc-900 dark:text-zinc-50">{nextPeriod.label}</span>.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="secondary" disabled={!weeklyReportAvailable}><Link
                    href={nextPreviewHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Anteprima report
                  </Link></Button>
                <form action={sendWeeklyReportNow}>
                  <Button
                    variant="black"
                    type="submit"
                    disabled={!weeklyReportAvailable}
                  >
                    Invia adesso il report
                  </Button>
                </form>
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                L&apos;invio manuale forza un nuovo invio anche se il report della stessa settimana e gia stato spedito.
              </p>
            </div>
          </div>
        </div>

        <div className="pg-card-base">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Storico invii</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Ultimi tentativi registrati dal sistema.</p>
            </div>
            {recentLogs.length > 0 && (
              <form action={clearWeeklyReportHistory}>
                <Button
                  variant="destructive-outline"
                  type="submit"
                  size="sm"
                >
                  Azzera storico
                </Button>
              </form>
            )}
          </div>

          {recentLogs.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Nessun invio registrato.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-3 py-2 font-semibold">Periodo</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Trigger</th>
                    <th className="px-3 py-2 font-semibold">Destinatari</th>
                    <th className="px-3 py-2 font-semibold">Inviato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/50">
                  {recentLogs.map((log) => {
                    const previewHref = `/admin/report-settimanale/preview?start=${encodeURIComponent(log.periodStart.toISOString())}&endExclusive=${encodeURIComponent(log.periodEnd.toISOString())}`;

                    return (
                      <tr key={log.id}>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                          {new Intl.DateTimeFormat("it-IT", {
                            dateStyle: "medium",
                            timeZone: "Europe/Rome",
                          }).format(log.periodStart)}{" "}
                          -{" "}
                          {new Intl.DateTimeFormat("it-IT", {
                            dateStyle: "medium",
                            timeZone: "Europe/Rome",
                          }).format(new Date(log.periodEnd.getTime() - 1000))}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`pg-badge-base ${
                              log.status === "SENT"
                                ? "pg-badge-emerald"
                                : log.status === "FAILED"
                                  ? "pg-badge-rose"
                                  : "pg-badge-zinc"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{log.trigger}</td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{log.recipientCount}</td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                          {formatDateTime(log.sentAt)}
                          {log.error ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{log.error}</p> : null}
                        </td>
                        <td className="px-3 py-3">
                          <Button asChild variant="secondary" size="xs"><Link
                              href={previewHref}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Anteprima
                            </Link></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error in AdminWeeklyReportPage:", error);
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
        <h2 className="text-lg font-semibold">Si è verificato un errore nel caricamento del report settimanale</h2>
        <p className="mt-2 text-sm italic opacity-80">
          {error instanceof Error ? error.message : "Errore interno del server"}
        </p>
        <div className="mt-6">
          <Button asChild variant="outline"><Link href="/admin">Torna alla dashboard</Link></Button>
        </div>
      </div>
    );
  }
}

