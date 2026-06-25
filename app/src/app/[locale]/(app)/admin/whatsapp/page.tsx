import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  KAPSO_WHATSAPP_CONFIG_ID,
  clearKapsoWhatsAppConfigCache,
  getKapsoWhatsAppConfig,
  maskKapsoValue,
} from "@/lib/kapso-config";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";

async function saveKapsoWhatsAppConfig(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);

  const apiKeyInput = (formData.get("apiKey") as string)?.trim();
  const phoneNumberId = (formData.get("phoneNumberId") as string)?.trim();
  const displayPhoneNumber = (formData.get("displayPhoneNumber") as string)?.trim() || null;

  const existing = await prisma.kapsoWhatsAppConfig.findUnique({
    where: { id: KAPSO_WHATSAPP_CONFIG_ID },
  });

  const apiKey = apiKeyInput || existing?.apiKey || "";
  if (!apiKey || !phoneNumberId) {
    throw new Error("Inserisci token API e ID numero WhatsApp.");
  }

  await prisma.kapsoWhatsAppConfig.upsert({
    where: { id: KAPSO_WHATSAPP_CONFIG_ID },
    update: {
      ...(apiKeyInput ? { apiKey: apiKeyInput } : {}),
      phoneNumberId,
      displayPhoneNumber,
    },
    create: {
      id: KAPSO_WHATSAPP_CONFIG_ID,
      apiKey,
      phoneNumberId,
      displayPhoneNumber,
    },
  });

  clearKapsoWhatsAppConfigCache();
  revalidatePath("/admin/whatsapp");
}

async function sendTestWhatsApp(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);

  const to = (formData.get("to") as string)?.trim();
  const body =
    (formData.get("body") as string)?.trim() ||
    "Messaggio di test dal pannello WhatsApp Kapso.";

  if (!to) {
    throw new Error("Inserisci un numero di telefono");
  }

  await sendKapsoWhatsAppText({ to, body });
  revalidatePath("/admin/whatsapp");
}

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

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Aggiorna credenziali</p>
          <form className="space-y-3" action={saveKapsoWhatsAppConfig}>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Token API Kapso
              <input
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder={apiKey ? "Lascia vuoto per mantenere il token attuale" : "Token da Kapso"}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              ID numero WhatsApp
              <input
                name="phoneNumberId"
                defaultValue={phoneNumberId}
                required
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="es. 597907523413541"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Numero WhatsApp (opzionale)
              <input
                name="displayPhoneNumber"
                defaultValue={displayPhoneNumber}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="+39..."
              />
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              L&apos;ID numero è il valore <code className="font-mono">phone_number_id</code> restituito da Kapso.
              Il numero visualizzato serve solo come riferimento per lo staff.
            </p>
            <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Salva configurazione
            </FormSubmitButton>
          </form>
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            I richiami automatici in <Link href="/richiami/regole" className="font-semibold underline">Regole automatiche</Link>{" "}
            useranno questa integrazione quando il canale è WhatsApp.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invio di test</p>
          <form action={sendTestWhatsApp} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1.4fr,auto] md:items-end">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Numero di destinazione
              <input
                name="to"
                required
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="+39..."
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Testo (opzionale)
              <input
                name="body"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="Messaggio di test dal pannello WhatsApp Kapso."
              />
            </label>
            <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Invia test WhatsApp
            </FormSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}