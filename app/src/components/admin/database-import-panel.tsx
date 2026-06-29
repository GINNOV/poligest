import { LocalizedFileInput } from "@/components/localized-file-input";
import { Button } from "@/components/ui/button";
import { IMPORT_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";
import { ImportForm } from "@/app/[locale]/(app)/magazzino/import-form";

type DatabaseImportPanelProps = {
  isBulkEnabled: boolean;
  importData: (formData: FormData) => Promise<void>;
};

export function DatabaseImportPanel({ isBulkEnabled, importData }: DatabaseImportPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Backup completo</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Ripristina il database da un file JSON esportato in precedenza.
            </p>
          </div>
          {!isBulkEnabled ? (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Non attivo
            </span>
          ) : null}
        </div>

        {isBulkEnabled ? (
          <form action={importData} className="mt-6 space-y-5">
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              Sostituisce tutti i dati attuali. Esporta un backup prima di procedere.
            </p>

            <LocalizedFileInput
              name="file"
              accept="application/json"
              required
              buttonText="Scegli backup JSON"
            />

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Digita <span className="font-mono text-xs text-zinc-500">{IMPORT_CONFIRMATION_TEXT}</span> per confermare
              <input
                name="confirmImport"
                placeholder={IMPORT_CONFIRMATION_TEXT}
                autoComplete="off"
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                required
              />
            </label>

            <Button type="submit" variant="black" size="lg" className="w-full rounded-full font-bold">
              Importa backup
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            Il ripristino completo è gestito dal supporto tecnico. Per aggiornare solo il magazzino usa il pannello a
            fianco.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Magazzino (CSV)</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Aggiorna quantità e movimenti senza modificare il resto del database.
        </p>
        <div className="mt-6">
          <ImportForm embedded />
        </div>
      </div>
    </section>
  );
}