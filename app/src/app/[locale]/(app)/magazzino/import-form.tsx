"use client";

import { useState } from "react";
import { importStockFromCSV } from "./actions";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { LocalizedFileInput } from "@/components/localized-file-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600",
        pending && "opacity-70 cursor-wait"
      )}
    >
      {pending ? "Importazione in corso..." : "Importa CSV"}
    </button>
  );
}

type ImportFormProps = {
  embedded?: boolean;
};

export function ImportForm({ embedded = false }: ImportFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    try {
      await importStockFromCSV(formData);
      setMessage("Importazione completata con successo!");
      // Reset the form? Native forms don't reset easily with server actions without a key change or ref.
      // A simple reload is often easiest, or just leave it.
    } catch (e) {
      setError("Errore durante l'importazione: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const form = (
    <>
      <form action={handleSubmit} className="space-y-3 text-sm">
        {!embedded ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Colonne: Paziente; Tipo; Marca; Data Acq; UDI-DI; UDI-PI; Data Int; Sede.
          </p>
        ) : null}
        <LocalizedFileInput
          name="file"
          accept=".csv"
          required
          buttonText="Scegli CSV"
          placeholder="Nessun file selezionato"
        />
        <SubmitButton />
      </form>
      {message ? <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-500">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-500">{error}</p> : null}
    </>
  );

  if (embedded) {
    return form;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Importa / Esporta</h2>
      <div className="mt-3">{form}</div>
    </div>
  );
}
