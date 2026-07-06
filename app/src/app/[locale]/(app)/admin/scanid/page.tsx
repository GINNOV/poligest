import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getScanIdMeta } from "@/lib/scanid-meta";

export const metadata = createPageMetadata(PAGE_TITLES.scanid);

export default async function ScanIdAdminPage() {
  await requireUser([Role.ADMIN]);

  const scanIdMeta = getScanIdMeta();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <div className="flex items-start gap-4">
          <Image
            src="/scanid-icon.png"
            alt="ScanID"
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-2xl shadow-sm"
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Integrazione macOS
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">ScanID</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              App macOS per leggere i documenti dei pazienti e inviare a Sorriso i dati anagrafici già pronti da
              verificare.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Versione consigliata</span>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-950 dark:text-emerald-100">
                {scanIdMeta.version}
              </div>
            </div>
            <a
              href={scanIdMeta.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:focus:ring-emerald-900"
            >
              Scarica
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Come si usa</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li>Scarica e apri ScanID sul Mac dello studio.</li>
            <li>Scansiona o seleziona il documento del paziente.</li>
            <li>Controlla i dati importati in Sorriso prima di salvarli.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
