import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel, isMissingPrismaModelError, runOptionalPrismaQuery } from "@/lib/prisma-models";
import { logAudit } from "@/lib/audit";
import { FormSubmitButton } from "@/components/form-submit-button";
import { REPORT_CONFIG_ID, getCompletedPracticeWeekPeriod, parseRecipientEmails, sendPracticeWeeklyReport } from "@/lib/practice-weekly-report";
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

export default async function AdminWeeklyReportPage() {
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
  const nextPeriod = getCompletedPracticeWeekPeriod();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Reportistica automatica
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Report settimanale studio</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Ogni report riepiloga visite completate per medico, promemoria inviati, nuovi pazienti,
          incassi registrati e altri indicatori utili a mostrare il valore operativo dell&apos;app.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Configurazione destinatari</p>
              <p className="text-xs text-zinc-600">
                Inserisci una o piu email, separate da virgola o una per riga.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                config?.enabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {config?.enabled ? "Attivo" : "Disattivo"}
            </span>
          </div>

          <form action={saveWeeklyReportConfig} className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={config?.enabled ?? false}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
              />
              Abilita l&apos;invio automatico del report settimanale
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Lista email
              <textarea
                name="recipientEmails"
                defaultValue={config?.recipientEmails ?? ""}
                rows={8}
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder={"studio@example.com\nmanager@example.com"}
              />
            </label>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
              Destinatari validi rilevati: <span className="font-semibold text-zinc-900">{recipients.length}</span>
            </div>

            <FormSubmitButton
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!weeklyReportAvailable}
            >
              Salva configurazione
            </FormSubmitButton>
          </form>
          {!weeklyReportAvailable ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Il modulo report settimanale non è disponibile nel server attivo.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">Invio manuale</p>
            <p className="mt-2 text-sm text-zinc-600">
              Il prossimo invio copre il periodo <span className="font-semibold text-zinc-900">{nextPeriod.label}</span>.
            </p>
            <form action={sendWeeklyReportNow} className="mt-4">
              <FormSubmitButton
                className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!weeklyReportAvailable}
              >
                Invia adesso il report
              </FormSubmitButton>
            </form>
            <p className="mt-3 text-xs text-zinc-500">
              L&apos;invio manuale forza un nuovo invio anche se il report della stessa settimana e gia stato spedito.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">Cron tecnico</p>
            <p className="mt-2 text-sm text-zinc-600">
              Il report viene verificato anche dal cron esistente dei richiami, quindi non serve creare un
              secondo job per far partire l&apos;invio settimanale.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Storico invii</p>
            <p className="text-xs text-zinc-600">Ultimi tentativi registrati dal sistema.</p>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
            Nessun invio registrato.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-semibold">Periodo</th>
                  <th className="px-3 py-2 font-semibold">Stato</th>
                  <th className="px-3 py-2 font-semibold">Trigger</th>
                  <th className="px-3 py-2 font-semibold">Destinatari</th>
                  <th className="px-3 py-2 font-semibold">Inviato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-3 text-zinc-700">
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
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          log.status === "SENT"
                            ? "bg-emerald-50 text-emerald-800"
                            : log.status === "FAILED"
                              ? "bg-rose-50 text-rose-800"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{log.trigger}</td>
                    <td className="px-3 py-3 text-zinc-700">{log.recipientCount}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {formatDateTime(log.sentAt)}
                      {log.error ? <p className="mt-1 text-xs text-rose-700">{log.error}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
