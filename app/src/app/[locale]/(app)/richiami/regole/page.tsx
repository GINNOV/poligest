import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NotificationChannel, Role } from "@prisma/client";
import { getAllEmailTemplates } from "@/lib/email-templates";
import { createRecallRule, deleteRecallRule, updateAppointmentReminderRule, updateRecallRule } from "@/app/[locale]/(app)/richiami/actions";

export default async function RichiamiRegolePage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  const [rules, servicesRaw, appointmentReminderRule, emailTemplates] = await Promise.all([
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.appointmentReminderRule.findFirst(),
    getAllEmailTemplates(),
  ]);

  const services = servicesRaw as Array<{ id: string; name: string }>;
  const reminderRuleExtras = appointmentReminderRule as unknown as {
    templateName?: string | null;
    timingType?: string | null;
    timeOfDayMinutes?: number | null;
  } | null;
  const appointmentReminderDefaults = {
    id: appointmentReminderRule?.id ?? "",
    daysBefore: appointmentReminderRule?.daysBefore ?? 1,
    channel: appointmentReminderRule?.channel ?? NotificationChannel.EMAIL,
    templateName: reminderRuleExtras?.templateName ?? "appointment-reminder",
    emailSubject: appointmentReminderRule?.emailSubject ?? "",
    message: appointmentReminderRule?.message ?? "",
    enabled: appointmentReminderRule?.enabled ?? true,
    timingType: reminderRuleExtras?.timingType ?? "SAME_DAY_TIME",
    timeOfDayMinutes: reminderRuleExtras?.timeOfDayMinutes ?? 540,
  };
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };
  const formatServiceLabel = (serviceType: string) =>
    serviceType === "ANY" ? "Qualunque servizio" : serviceType;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Regole automatiche</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Definisci intervalli per richiami ricorrenti e promemoria appuntamenti.
          </p>
        </div>
        <Link
          href="/richiami"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
        Torna ai richiami
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <form action={createRecallRule} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Nome regola</span>
              <input
                name="name"
                placeholder="Es. Igiene semestrale"
                required
                className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Servizio</span>
              <select
                name="serviceType"
                required
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                defaultValue=""
              >
                <option value="ANY">Qualunque servizio</option>
                <option value="" disabled>
                  Seleziona servizio
                </option>
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Intervallo (giorni)</span>
              <input
                name="intervalDays"
                type="number"
                min="1"
                placeholder="Es. 180"
                required
                className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Canale</span>
              <select
                name="channel"
                required
                defaultValue="EMAIL"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Email + SMS</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Template</span>
              <select
                name="templateName"
                required
                defaultValue=""
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="" disabled>
                  Seleziona template
                </option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.name}>
                    {template.description ?? template.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
            >
              Aggiorna regola automatica
            </button>
          </form>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
              Regole esistenti
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {rules.length === 0 ? (
                <p className="text-xs text-zinc-500">Nessuna regola configurata.</p>
              ) : (
                rules.map((rule) => {
                  const extras = rule as unknown as {
                    channel?: string | null;
                    emailSubject?: string | null;
                    templateName?: string | null;
                  };
                  const channel = extras.channel ?? "EMAIL";
                  const emailSubject = extras.emailSubject ?? null;
                  const templateName = extras.templateName ?? null;
                  const serviceOptionMissing =
                    rule.serviceType !== "ANY" && !services.some((s) => s.name === rule.serviceType);
                  return (
                    <details
                      key={rule.id}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-zinc-900">{rule.name}</p>
                          <p className="text-xs text-zinc-600">
                            {formatServiceLabel(rule.serviceType)} · ogni {rule.intervalDays} giorni · {channel}
                          </p>
                          {emailSubject ? (
                            <p className="text-[11px] text-zinc-500">Oggetto email: {emailSubject}</p>
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold text-emerald-700">Modifica</span>
                      </summary>
                      <form action={updateRecallRule} className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <label className="flex flex-col gap-2 sm:col-span-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Nome regola</span>
                          <input
                            name="name"
                            defaultValue={rule.name}
                            required
                            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Servizio</span>
                          <select
                            name="serviceType"
                            required
                            defaultValue={rule.serviceType}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value="ANY">Qualunque servizio</option>
                            {serviceOptionMissing ? (
                              <option value={rule.serviceType}>{formatServiceLabel(rule.serviceType)}</option>
                            ) : null}
                            {services.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Intervallo (giorni)</span>
                          <input
                            name="intervalDays"
                            type="number"
                            min="1"
                            defaultValue={rule.intervalDays}
                            required
                            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Canale</span>
                          <select
                            name="channel"
                            required
                            defaultValue={channel}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="BOTH">Email + SMS</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 sm:col-span-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Template</span>
                          <select
                            name="templateName"
                            defaultValue={templateName ?? ""}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          >
                            {templateName && !emailTemplates.some((template) => template.name === templateName) ? (
                              <option value={templateName}>{templateName}</option>
                            ) : null}
                            {emailTemplates.map((template) => (
                              <option key={template.id} value={template.name}>
                                {template.description ?? template.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Oggetto email</span>
                          <input
                            name="emailSubject"
                            defaultValue={emailSubject ?? ""}
                            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="flex flex-col gap-2 sm:col-span-2">
                          <span className="text-xs font-semibold uppercase text-zinc-500">Messaggio</span>
                          <textarea
                            name="message"
                            defaultValue={rule.message ?? ""}
                            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            rows={3}
                          />
                        </label>
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
                        >
                          Aggiorna modifiche
                        </button>
                      </form>
                      <form
                        action={deleteRecallRule}
                        className="mt-3"
                        data-confirm="Eliminare definitivamente questa regola di richiamo?"
                      >
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                        >
                          Elimina
                        </button>
                      </form>
                    </details>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <form
          action={updateAppointmentReminderRule}
          className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm"
        >
          <input type="hidden" name="ruleId" value={appointmentReminderDefaults.id} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">Promemoria appuntamenti</h3>
              <p className="text-xs text-emerald-700">
                Invia un promemoria automatico prima di ogni appuntamento programmato.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={appointmentReminderDefaults.enabled}
                className="h-4 w-4 rounded border-emerald-200 text-emerald-600"
              />
              Attiva regola
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Logica invio</span>
              <select
                name="timingType"
                defaultValue={appointmentReminderDefaults.timingType}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="DAYS_BEFORE">Giorni prima</option>
                <option value="SAME_DAY_TIME">Stesso giorno a orario fisso</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Invia (giorni prima)</span>
              <input
                name="daysBefore"
                type="number"
                min="1"
                defaultValue={appointmentReminderDefaults.daysBefore}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="text-[11px] text-emerald-700">Usato solo con "Giorni prima".</span>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Orario invio</span>
              <input
                name="timeOfDay"
                type="time"
                defaultValue={formatTime(appointmentReminderDefaults.timeOfDayMinutes)}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="text-[11px] text-emerald-700">Default 09:00, usato con "Stesso giorno".</span>
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Canale</span>
              <select
                name="channel"
                required
                defaultValue={appointmentReminderDefaults.channel}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Email + SMS</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Template email</span>
              <select
                name="templateName"
                defaultValue={appointmentReminderDefaults.templateName}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.name}>
                    {template.description ?? template.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-3"
            >
              Aggiorna regola
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
