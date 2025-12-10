"use client";

import { useState } from "react";
import { importStockFromCSV } from "./actions";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

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

export function ImportForm() {
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

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Importa / Esporta</h2>
      <form action={handleSubmit} className="mt-3 space-y-3 text-sm">
        <p className="text-xs text-zinc-500">Carica un file CSV con colonne: Paziente; Tipo; Marca; Data Acq; UDI-DI; UDI-PI; Data Int; Sede.</p>
        <input type="file" name="file" accept=".csv" required className="w-full text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100" />
        <SubmitButton />
      </form>
      {message && <p className="mt-2 text-xs font-medium text-emerald-600">{message}</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
