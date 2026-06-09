import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ScanIdClient } from "./ScanIdClient";

export default async function ScanIdAdminPage() {
  await requireUser([Role.ADMIN]);

  const apiKey = process.env.MACOS_APP_API_KEY || "poligest_macos_secret";

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Integrazione macOS
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">ScanID</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Collega l&apos;applicazione nativa macOS per la scansione delle carte d&apos;identità italiane e tessere sanitarie.
        </p>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* API key display widget */}
        <div className="space-y-4">
          <ScanIdClient apiKey={apiKey} />
          
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stato del servizio API</span>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              L&apos;applicazione macOS invia le richieste POST sicure all&apos;endpoint <code className="rounded bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-zinc-800 dark:text-zinc-200">/api/patients</code>.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Pronto a ricevere scansioni</span>
            </div>
          </div>

          {/* Latest ScanID version + download (driven by same envs as /api/scanid/meta) */}
          {(() => {
            const latestVersion = process.env.SCANID_LATEST_VERSION || "1.1.0";
            const downloadUrl =
              process.env.SCANID_DOWNLOAD_URL ||
              "https://github.com/GINNOV/poligest/releases";
            return (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Versione ScanID consigliata</span>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-950 dark:text-emerald-100">{latestVersion}</div>
                  </div>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Scarica ScanID
                  </a>
                </div>
                <p className="mt-2 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  Usa il pulsante <strong>Controlla aggiornamenti</strong> all&apos;interno di ScanID (Preferenze → Sorriso) per ricevere notifiche automatiche delle nuove versioni.
                </p>
              </div>
            );
          })()}
        </div>

        {/* Setup guide */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Guida alla configurazione</p>
          
          <ol className="space-y-4 text-xs text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">1</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Avvia ScanID su macOS</p>
                <p className="mt-0.5">Apri l&apos;applicazione nativa di scansione documenti sul tuo computer Mac.</p>
              </div>
            </li>
            
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">2</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Apri le Preferenze</p>
                <p className="mt-0.5">Fai clic su **Impostazioni** (icona ingranaggio) nella barra degli strumenti oppure premi la combinazione di tasti <kbd className="rounded bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">Cmd + ,</kbd>.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">3</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Seleziona il pannello Sorriso</p>
                <p className="mt-0.5">Seleziona la scheda **Sorriso** nella parte superiore della finestra delle preferenze.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">4</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Configura l&apos;indirizzo del server</p>
                <p className="mt-0.5">Verifica che il campo **Sorriso Server URL** contenga l&apos;indirizzo del server (es. <code className="font-mono text-[11px]">https://sorrisosplendente.com</code>).</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">5</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Incolla la chiave API</p>
                <p className="mt-0.5">Copia la chiave API visualizzata a sinistra e incollala nel campo **API Key / Token**.</p>
              </div>
            </li>
          </ol>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Dopo la configurazione, usa <strong>Controlla aggiornamenti</strong> nelle Preferenze di ScanID per verificare la presenza di nuove versioni.
          </p>
        </div>
      </div>
    </div>
  );
}
