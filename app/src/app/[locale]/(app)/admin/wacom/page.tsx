import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  WACOM_CONFIG_ID,
  clearWacomConfigCache,
  getWacomLicenseConfig,
  maskWacomValue,
} from "@/lib/wacom-config";
import { getWacomMeta } from "@/lib/wacom-meta";

async function saveWacomConfig(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);

  const licenseKey = (formData.get("licenseKey") as string)?.trim();
  const licenseSecret = (formData.get("licenseSecret") as string)?.trim();

  if (!licenseKey || !licenseSecret) {
    throw new Error("Inserisci chiave e secret della licenza Wacom.");
  }

  await prisma.wacomConfig.upsert({
    where: { id: WACOM_CONFIG_ID },
    update: { licenseKey, licenseSecret },
    create: { id: WACOM_CONFIG_ID, licenseKey, licenseSecret },
  });

  clearWacomConfigCache();
  revalidatePath("/admin/wacom");
}

export default async function WacomAdminPage() {
  await requireUser([Role.ADMIN]);

  const [wacomMeta, license] = await Promise.all([getWacomMeta(), getWacomLicenseConfig()]);
  const isReady = wacomMeta.licenseConfigured && wacomMeta.sdkFilesPresent;
  const licenseKey = license?.licenseKey ?? "";
  const licenseSecret = license?.licenseSecret ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-3xl shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            ✍️
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Integrazione firma digitale
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Wacom STU-430</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Gestisci la licenza Wacom per acquisire le firme digitali nei consensi informati e nei preventivi.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stato integrazione</span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  wacomMeta.licenseConfigured
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {wacomMeta.licenseConfigured ? "Configurata" : "Non configurata"}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <dt className="font-semibold">Chiave licenza</dt>
                <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{maskWacomValue(licenseKey)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <dt className="font-semibold">Secret licenza</dt>
                <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{maskWacomValue(licenseSecret)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <dt className="font-semibold">Origine</dt>
                <dd className="text-xs text-zinc-600 dark:text-zinc-400">
                  {wacomMeta.licenseSource === "db"
                    ? "Database"
                    : wacomMeta.licenseSource === "env"
                      ? "Variabili ambiente (fallback)"
                      : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <dt className="font-semibold">SDK in /public/wacom</dt>
                <dd
                  className={`text-xs font-semibold ${wacomMeta.sdkFilesPresent ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                >
                  {wacomMeta.sdkFilesPresent ? "Presente" : "Mancante"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isReady ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span
                className={`text-xs font-semibold ${isReady ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
              >
                {isReady ? "Pronto per acquisire firme" : "Configurazione incompleta"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dove si usa</span>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
              <li>Consensi informati nella scheda paziente (pulsante <strong>Wacom</strong>)</li>
              <li>Firma dei preventivi nella sezione preventivo</li>
            </ul>
            <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              Se il tablet non è collegato, lo staff può usare il pulsante <strong>Tablet</strong> per firmare con mouse o touch.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Aggiorna licenza Wacom</p>
            <form className="space-y-3" action={saveWacomConfig}>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                License key
                <input
                  name="licenseKey"
                  defaultValue={licenseKey}
                  required
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder="Chiave licenza Wacom"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                License secret
                <input
                  name="licenseSecret"
                  defaultValue={licenseSecret}
                  required
                  className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder="Secret licenza Wacom"
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Le credenziali vengono salvate nel database e usate subito per le firme. Nessun riavvio necessario.
              </p>
              <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
                Aggiorna configurazione
              </FormSubmitButton>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Guida rapida</p>
            <ol className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
              <li>Collega il tablet STU-430 via USB.</li>
              <li>Usa Chrome o Edge su desktop (WebHID).</li>
              <li>
                In sviluppo esegui <code className="font-mono text-[11px]">npm run wacom:sync</code> per copiare
                l&apos;SDK in <code className="font-mono text-[11px]">public/wacom/</code>.
              </li>
              <li>Apri un consenso o preventivo e premi <strong>Wacom</strong> per una prova.</li>
            </ol>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Torna alla{" "}
              <Link href="/admin" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                dashboard Amministrazione
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}