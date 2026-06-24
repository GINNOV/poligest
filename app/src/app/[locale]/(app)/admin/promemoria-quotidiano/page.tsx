import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel, runOptionalPrismaQuery } from "@/lib/prisma-models";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import {
  DAILY_REMINDER_CONFIG_ID,
  sendDailyReminders,
} from "@/lib/daily-reminder";
import { Role, RecurringMessageStatus } from "@prisma/client";
import { formatDateInputValueInTimeZone } from "@/lib/user-display-time-zone";

const formatDateTime = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Rome",
      }).format(value)
    : "—";

const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: "Admin / Clinico",
  [Role.MANAGER]: "Medico / Manager",
  [Role.ASSISTANT]: "Assistente",
  [Role.SECRETARY]: "Segretaria",
  [Role.PATIENT]: "Paziente",
};

async function saveDailyReminderConfig(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const configClient = getOptionalPrismaModel<{
    upsert?: (args: {
      where: { id: string };
      update: { enabled: boolean; sendTimeMinutes: number; targetRoles: Role[] };
      create: { id: string; enabled: boolean; sendTimeMinutes: number; targetRoles: Role[] };
    }) => Promise<unknown>;
  }>("dailyReminderConfig");
  
  const enabled = formData.get("enabled") === "on";
  const timeStr = (formData.get("sendTime") as string) || "20:30";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const sendTimeMinutes = hours * 60 + minutes;

  const targetRoles = formData.getAll("targetRoles") as Role[];

  if (!configClient?.upsert) {
    throw new Error("Il modulo promemoria quotidiano non è disponibile nel server attivo.");
  }

  await configClient.upsert({
    where: { id: DAILY_REMINDER_CONFIG_ID },
    update: { enabled, sendTimeMinutes, targetRoles },
    create: { id: DAILY_REMINDER_CONFIG_ID, enabled, sendTimeMinutes, targetRoles },
  });

  await logAudit(admin, {
    action: "practice.daily_reminder_config_updated",
    entity: "System",
    entityId: DAILY_REMINDER_CONFIG_ID,
    metadata: { enabled, sendTimeMinutes, targetRoles },
  });

  revalidatePath("/admin/promemoria-quotidiano");
}

async function sendDailyRemindersNow() {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  await sendDailyReminders({
    force: true,
    trigger: "MANUAL",
    actor: admin,
  });

  revalidatePath("/admin/promemoria-quotidiano");
}

async function clearDailyReminderHistory() {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const logClient = getOptionalPrismaModel<{
    deleteMany?: (args: Record<string, unknown>) => Promise<unknown>;
  }>("dailyReminderLog");

  if (!logClient?.deleteMany) {
    throw new Error("Il modulo promemoria quotidiano non è disponibile nel server attivo.");
  }

  await logClient.deleteMany({});

  await logAudit(admin, {
    action: "practice.daily_reminder_history_cleared",
    entity: "System",
    entityId: DAILY_REMINDER_CONFIG_ID,
  });

  revalidatePath("/admin/promemoria-quotidiano");
}

interface DailyReminderLogRecord {
  id: string;
  userId: string;
  date: Date;
  status: RecurringMessageStatus;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
  user: {
    name: string | null;
    email: string;
  };
}

export const metadata = createPageMetadata(PAGE_TITLES.promemoriaQuotidiano);

export default async function AdminDailyReminderPage() {
  try {
    await requireUser([Role.ADMIN]);
    const configClient = getOptionalPrismaModel<{
      findUnique?: (args: { where: { id: string } }) => Promise<{
        enabled: boolean;
        sendTimeMinutes: number;
        targetRoles: Role[];
      } | null>;
    }>("dailyReminderConfig");
    const logClient = getOptionalPrismaModel<{
      findMany?: (args: {
        orderBy: { createdAt: "asc" | "desc" };
        take: number;
        include: { user: { select: { name: true, email: true } } };
      }) => Promise<Array<DailyReminderLogRecord>>;
    }>("dailyReminderLog");

    const [configResult, logResult] = await Promise.all([
      runOptionalPrismaQuery(
        configClient?.findUnique ? () => configClient.findUnique!({ where: { id: DAILY_REMINDER_CONFIG_ID } }) : undefined,
        null,
      ),
      runOptionalPrismaQuery(
        logClient?.findMany
          ? () =>
              logClient.findMany!({
                orderBy: { createdAt: "desc" },
                take: 20,
                include: { user: { select: { name: true, email: true } } },
              })
          : undefined,
        [],
      ),
    ]);
    
    const config = configResult.value;
    const recentLogs = logResult.value;
    
    // Explicitly set to true as we've confirmed the tables exist and migrations are applied
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const moduleAvailable = true; 

    const currentRoles = config?.targetRoles ?? [Role.ADMIN, Role.MANAGER, Role.ASSISTANT, Role.SECRETARY];

    // Fetch all staff users for the roles list, including those without doctor profile
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.MANAGER, Role.ASSISTANT, Role.SECRETARY] },
        isActive: true,
      },
      include: {
        doctor: { select: { id: true, fullName: true } }
      },
      orderBy: { name: "asc" },
    });

    const hours = Math.floor((config?.sendTimeMinutes ?? 1230) / 60);
    const mins = (config?.sendTimeMinutes ?? 1230) % 60;
    const timeValue = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

    const todayStr = formatDateInputValueInTimeZone(new Date(), "Europe/Rome");
    const tomorrowStr = formatDateInputValueInTimeZone(new Date(Date.now() + 24 * 60 * 60 * 1000), "Europe/Rome");

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Staff Notifications
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Promemoria quotidiano staff</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Invia automaticamente un riepilogo degli appuntamenti del giorno successivo a ogni medico o membro dello staff assegnato.
            Ogni destinatario riceve esclusivamente la propria agenda.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="pg-card-base">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Configurazione</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Definisci se e quando inviare il riepilogo.
                </p>
              </div>
              <span
                className={`pg-badge-base ${(config?.enabled ?? true) ? "pg-badge-emerald" : "pg-badge-zinc"}`}
              >
                {(config?.enabled ?? true) ? "Attivo" : "Disattivo"}
              </span>
            </div>

            <form action={saveDailyReminderConfig} className="mt-5 space-y-6">
              <label className="pg-card-flat flex items-center gap-3 px-4 py-3 text-sm font-medium">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={config?.enabled ?? true}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
                Abilita l&apos;invio automatico del promemoria quotidiano
              </label>

              <div className="space-y-4">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Orario di invio (il giorno prima)
                  <input
                    type="time"
                    name="sendTime"
                    defaultValue={timeValue}
                    className="w-full max-w-[150px] rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-950/50"
                  />
                </label>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Ruoli destinatari</p>
                  <p className="text-xs text-zinc-500">Seleziona quali ruoli devono ricevere il promemoria. Nota: l&apos;utente deve avere un profilo medico associato in &quot;Utenti Sistema&quot;.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[Role.ADMIN, Role.MANAGER, Role.ASSISTANT, Role.SECRETARY].map((role) => (
                      <label key={role} className="pg-card-flat flex items-center gap-3 px-4 py-2 text-sm">
                        <input
                          type="checkbox"
                          name="targetRoles"
                          value={role}
                          defaultChecked={currentRoles.includes(role)}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        {roleLabels[role]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                <p className="font-semibold text-zinc-900 dark:text-zinc-200">Dettagli invio</p>
                <p className="mt-1">
                  Il sistema scansiona l&apos;agenda del giorno successivo e invia una mail personalizzata a ogni utente dei ruoli selezionati che ha almeno un appuntamento programmato.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto"
              >
                Salva configurazione
              </Button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="pg-card-base">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 pb-3 dark:border-zinc-800">Anteprima report</p>
              <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
                Scegli un utente per vedere come apparirà la sua agenda.
              </p>
              <div className="mt-4 flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                {staffUsers.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic px-2 py-4">Nessun utente con ruolo staff trovato.</p>
                ) : (
                  staffUsers.map((sUser) => (
                    <div key={sUser.id} className="flex flex-col gap-1 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-xs font-bold truncate">{sUser.name || sUser.email}</span>
                        {!sUser.doctor && (
                           <span className="text-[8px] font-bold text-rose-600 uppercase bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-full">Scollegato</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="secondary" size="xs" className="flex-1" disabled={!sUser.doctor}>
                          <Link
                            href={`/admin/promemoria-quotidiano/preview?userId=${sUser.id}&date=${todayStr}`}
                            target="_blank"
                          >
                            Oggi
                          </Link>
                        </Button>
                        <Button asChild variant="secondary" size="xs" className="flex-1" disabled={!sUser.doctor}>
                          <Link
                            href={`/admin/promemoria-quotidiano/preview?userId=${sUser.id}&date=${tomorrowStr}`}
                            target="_blank"
                          >
                            Domani
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[10px] text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300">
                 <strong>Suggerimento:</strong> Associa gli utenti ai profili medici in &quot;Utenti Sistema&quot; per abilitare i loro promemoria.
              </div>
            </div>

            <div className="pg-card-base">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Test rapido</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Invia immediatamente i promemoria per gli appuntamenti di domani a tutto lo staff abilitato.
              </p>
              <form action={sendDailyRemindersNow} className="mt-4">
                <Button
                  variant="black"
                  type="submit"
                  className="w-full"
                >
                  Invia promemoria ora
                </Button>
              </form>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 italic">
                Nota: Vengono inviati solo se ci sono appuntamenti per domani.
              </p>
            </div>
          </div>
        </div>

        <div className="pg-card-base">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Log ultimi invii</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Tracciamento delle email inviate allo staff.</p>
            </div>
            {recentLogs.length > 0 && (
              <form action={clearDailyReminderHistory}>
                <Button
                  variant="destructive-outline"
                  type="submit"
                  size="sm"
                >
                  Azzera log
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
                    <th className="px-3 py-2 font-semibold">Destinatario</th>
                    <th className="px-3 py-2 font-semibold">Data Agenda</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Inviato il</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/50">
                  {recentLogs.map((log: DailyReminderLogRecord) => (
                    <tr key={log.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">{log.user.name || "Utente"}</div>
                        <div className="text-xs text-zinc-500">{log.user.email}</div>
                      </td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                        {new Intl.DateTimeFormat("it-IT", {
                          dateStyle: "medium",
                          timeZone: "Europe/Rome",
                        }).format(log.date)}
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
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatDateTime(log.sentAt)}
                        {log.error ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{log.error}</p> : null}
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
  } catch (error) {
    console.error("Error in AdminDailyReminderPage:", error);
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
        <h2 className="text-lg font-semibold">Errore nel caricamento del modulo</h2>
        <p className="mt-2 text-sm italic opacity-80">
          {error instanceof Error ? error.message : "Errore interno"}
        </p>
        <div className="mt-6">
          <Button asChild variant="outline"><Link href="/admin">Torna alla dashboard</Link></Button>
        </div>
      </div>
    );
  }
}
