import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";

function mask(value?: string | null, show = 3) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= show) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, show)}${"*".repeat(Math.max(0, trimmed.length - show - 2))}${trimmed.slice(-2)}`;
}

async function saveClickSendConfig(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);

  const username = (formData.get("username") as string)?.trim();
  const apiKey = (formData.get("apiKey") as string)?.trim();
  const from = (formData.get("from") as string)?.trim() || null;

  if (!username || !apiKey) {
    throw new Error("Inserisci username e API key.");
  }

  await prisma.smsProviderConfig.upsert({
    where: { id: "clicksend" },
    update: { username, apiKey, from },
    create: { id: "clicksend", username, apiKey, from },
  });

  revalidatePath("/admin/clicksend");
}

export default async function ClickSendSettingsPage() {
  await requireUser([Role.ADMIN]);

  const config = await prisma.smsProviderConfig.findUnique({ where: { id: "clicksend" } });
  const username = config?.username ?? "";
  const apiKey = config?.apiKey ?? "";
  const from = config?.from ?? "";
  const isConfigured = Boolean(username && apiKey);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Integrazione SMS
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">ClickSend</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Gestisci le credenziali per l&apos;invio di SMS. Le credenziali vengono salvate nel database e
          usate per tutti gli invii.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Stato configurazione</p>
              <p className="text-xs text-zinc-600">Verifica se username e API key sono presenti.</p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isConfigured ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
              }`}
            >
              {isConfigured ? "Configurato" : "Non configurato"}
            </span>
          </div>

          <dl className="mt-4 space-y-3 text-sm text-zinc-800">
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              <dt className="font-semibold">Username</dt>
              <dd className="font-mono text-xs text-zinc-600">{mask(username)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              <dt className="font-semibold">API key</dt>
              <dd className="font-mono text-xs text-zinc-600">{mask(apiKey)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              <dt className="font-semibold">Mittente</dt>
              <dd className="font-mono text-xs text-zinc-600">
                {from ? from : "Non impostato (opzionale)"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-900">Aggiorna credenziali</p>
          <form className="space-y-3" action={saveClickSendConfig}>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              Username ClickSend
              <input
                name="username"
                defaultValue={username}
                required
                className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="es. email o user ClickSend"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              API key
              <input
                name="apiKey"
                defaultValue={apiKey}
                required
                className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="chiave API ClickSend"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              Mittente (opzionale)
              <input
                name="from"
                defaultValue={from}
                className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Numero o sender ID approvato"
              />
            </label>
            <p className="text-xs text-zinc-500">
              Le credenziali vengono salvate nel database e usate subito per gli invii SMS. Nessun riavvio
              necessario.
            </p>
            <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Salva configurazione
            </FormSubmitButton>
          </form>
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Puoi verificare l&apos;invio dagli <Link href="/admin/sms-templates" className="font-semibold underline">ultimi invii SMS</Link>
            . Se le credenziali mancano, l&apos;app userà la modalità simulata e registrerà comunque il log.
          </p>
        </div>
      </div>
    </div>
  );
}
