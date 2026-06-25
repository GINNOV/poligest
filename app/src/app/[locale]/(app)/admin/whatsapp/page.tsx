import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  KAPSO_WHATSAPP_CONFIG_ID,
  getKapsoWhatsAppConfig,
  maskKapsoValue,
} from "@/lib/kapso-config";
import { saveKapsoWhatsAppConfig, sendTestWhatsApp } from "@/lib/admin/whatsapp-actions";
import { WhatsAppConfigForm, WhatsAppTestForm } from "@/components/admin/whatsapp-settings-forms";

export const metadata = createPageMetadata(PAGE_TITLES.whatsapp);

export default async function WhatsAppSettingsPage() {
  await requireUser([Role.ADMIN]);

  const [config, runtimeConfig] = await Promise.all([
    prisma.kapsoWhatsAppConfig.findUnique({ where: { id: KAPSO_WHATSAPP_CONFIG_ID } }),
    getKapsoWhatsAppConfig(),
  ]);

  const apiKey = config?.apiKey ?? "";
  const phoneNumberId = config?.phoneNumberId ?? runtimeConfig?.phoneNumberId ?? "";
  const displayPhoneNumber = config?.displayPhoneNumber ?? runtimeConfig?.displayPhoneNumber ?? "";
  const isConfigured = Boolean(runtimeConfig?.apiKey && runtimeConfig?.phoneNumberId);
  const configSource = runtimeConfig?.source === "db" ? "Database" : runtimeConfig ? "Variabili ambiente" : "Non configurato";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Integrazione WhatsApp
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Kapso WhatsApp</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Configura token e numero WhatsApp usati per richiami automatici e promemoria. Le credenziali vengono
          salvate nel database e usate subito, senza riavvio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stato configurazione</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Fonte attiva: {configSource}</p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isConfigured
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
            >
              {isConfigured ? "Configurato" : "Non configurato"}
            </span>
          </div>

          <dl className="mt-4 space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="font-semibold">Token API</dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{maskKapsoValue(apiKey)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="font-semibold">ID numero WhatsApp</dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{phoneNumberId || "—"}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="font-semibold">Numero visualizzato</dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {displayPhoneNumber || "Non impostato (opzionale)"}
              </dd>
            </div>
          </dl>
        </div>

        <WhatsAppConfigForm
          phoneNumberId={phoneNumberId}
          displayPhoneNumber={displayPhoneNumber}
          hasStoredApiKey={Boolean(apiKey)}
          saveAction={saveKapsoWhatsAppConfig}
        />

        <WhatsAppTestForm sendTestAction={sendTestWhatsApp} />
      </div>
    </div>
  );
}