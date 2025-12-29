import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NotificationChannel, Role } from "@prisma/client";
import { createRecallRule, deleteRecallRule, updateAppointmentReminderRule, updateRecallRule } from "@/app/[locale]/(app)/richiami/actions";

export default async function RichiamiRegolePage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  const [rules, servicesRaw, appointmentReminderRule] = await Promise.all([
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.appointmentReminderRule.findFirst(),
  ]);

  const services = servicesRaw as Array<{ id: string; name: string }>;
  const appointmentReminderDefaults = {
    id: appointmentReminderRule?.id ?? "",
    daysBefore: appointmentReminderRule?.daysBefore ?? 1,
    channel: appointmentReminderRule?.channel ?? NotificationChannel.EMAIL,
    emailSubject: appointmentReminderRule?.emailSubject ?? "",
    message: appointmentReminderRule?.message ?? "",
    enabled: appointmentReminderRule?.enabled ?? true,
  };

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
          Torna alle sezioni
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
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Oggetto email</span>
              <input
                name="emailSubject"
                placeholder="Facoltativo"
                className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Messaggio</span>
              <textarea
                name="message"
                placeholder="Facoltativo: se vuoto useremo un messaggio standard."
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                rows={3}
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
            >
              Salva regola automatica
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
                  const extras = rule as unknown as { channel?: string | null; emailSubject?: string | null };
                  const channel = extras.channel ?? "EMAIL";
                  const emailSubject = extras.emailSubject ?? null;
                  const serviceOptionMissing = !services.some((s) => s.name === rule.serviceType);
                  return (
                    <details
                      key={rule.id}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-zinc-900">{rule.name}</p>
                          <p className="text-xs text-zinc-600">
                            {rule.serviceType} · ogni {rule.intervalDays} giorni · {channel}
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
                            {serviceOptionMissing ? (
                              <option value={rule.serviceType}>{rule.serviceType}</option>
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
                          Salva modifiche
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
              Attivo
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Invia (giorni prima)</span>
              <input
                name="daysBefore"
                type="number"
                min="1"
                defaultValue={appointmentReminderDefaults.daysBefore}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="flex flex-col gap-2">
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
              <span className="text-xs font-semibold uppercase text-emerald-700">Oggetto email</span>
              <input
                name="emailSubject"
                placeholder="Facoltativo"
                defaultValue={appointmentReminderDefaults.emailSubject}
                className="h-10 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Messaggio</span>
              <textarea
                name="message"
                placeholder="Facoltativo: se vuoto useremo un promemoria standard."
                defaultValue={appointmentReminderDefaults.message}
                className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                rows={3}
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
            >
              Salva promemoria appuntamenti
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
