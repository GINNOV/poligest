import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { RECURRING_MESSAGE_DEFAULTS } from "@/lib/recurring-messages";
import { updateRecurringConfig } from "@/app/[locale]/(app)/richiami/actions";

export default async function RichiamiRicorrentiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const recurringConfigsRaw = await prisma.recurringMessageConfig.findMany();
  const recurringConfigs = RECURRING_MESSAGE_DEFAULTS.map((defaults) => {
    const stored = recurringConfigsRaw.find((config) => config.kind === defaults.kind);
    return {
      kind: defaults.kind,
      enabled: stored?.enabled ?? true,
      subject: stored?.subject ?? defaults.subject,
      body: stored?.body ?? defaults.body,
      daysBefore: stored?.daysBefore ?? defaults.daysBefore ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Comunicazioni ricorrenti</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Email automatiche per festivita, chiusure studio e compleanni.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/docs/richiami"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800"
          >
            Guida
          </Link>
          <Link
            href="/richiami"
            className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Torna alle sezioni
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-zinc-500">
          Le email vengono inviate a tutti i pazienti con email valida.
        </p>
        <div className="mt-4 space-y-4">
          {recurringConfigs.map((config) => {
            const label =
              config.kind === "HOLIDAY"
                ? "Festivita italiane"
                : config.kind === "CLOSURE"
                  ? "Chiusure studio"
                  : "Compleanni";
            return (
              <form
                key={config.kind}
                action={updateRecurringConfig}
                className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm"
              >
                <input type="hidden" name="kind" value={config.kind} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={config.enabled}
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                    />
                    Attivo
                  </label>
                </div>
                {config.kind === "CLOSURE" ? (
                  <label className="mt-3 flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Invia (giorni prima)</span>
                    <input
                      name="daysBefore"
                      type="number"
                      min="1"
                      defaultValue={config.daysBefore ?? 7}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                ) : null}
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase text-zinc-500">Oggetto email</span>
                  <input
                    name="subject"
                    defaultValue={config.subject}
                    required
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase text-zinc-500">Messaggio</span>
                  <textarea
                    name="body"
                    defaultValue={config.body}
                    required
                    rows={3}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Salva impostazioni
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
