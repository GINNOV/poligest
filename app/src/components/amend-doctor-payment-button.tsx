"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Payment = {
  id: string;
  amount: string;
  description: string;
  occurredAt: Date;
  methodLabel: string | null;
};

type Props = {
  payment: Payment;
  action: (formData: FormData) => Promise<void>;
};

export function AmendDoctorPaymentButton({ payment, action }: Props) {
  const [open, setOpen] = useState(false);
  const [issubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      await action(formData);
      setOpen(false);
    } catch (error) {
      console.error("Failed to amend payment", error);
      alert("Si è verificato un errore durante la correzione.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const dateValue = payment.occurredAt.toISOString().split("T")[0];
  
  // Try to map the localized label back to the enum value for the default selection
  const methodMap: Record<string, string> = {
    "elettronico": "ELECTRONIC",
    "contanti": "CASH",
    "bonifico": "BANK_TRANSFER",
    "pagherò": "PAY_LATER",
    "altro": "OTHER"
  };
  const defaultMethod = payment.methodLabel ? (methodMap[payment.methodLabel.toLowerCase()] || "ELECTRONIC") : "ELECTRONIC";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="px-3 font-semibold"
      >
        Ammenda
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <div className="border-b border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Correggi pagamento</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Modifica i dati del record. La modifica verrà tracciata.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <input type="hidden" name="entryId" value={payment.id} />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Importo</label>
                  <input
                    type="number"
                    name="amount"
                    defaultValue={payment.amount}
                    min="0.01"
                    step="0.01"
                    required
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Data</label>
                  <input
                    type="date"
                    name="occurredAt"
                    defaultValue={dateValue}
                    required
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Metodo</label>
                <select
                  name="paymentMethod"
                  required
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  defaultValue={defaultMethod}
                >
                  <option value="ELECTRONIC">Elettronico</option>
                  <option value="CASH">Contanti</option>
                  <option value="BANK_TRANSFER">Bonifico</option>
                  <option value="PAY_LATER">Pagherò</option>
                  <option value="OTHER">Altro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nota / Descrizione</label>
                <input
                  name="note"
                  defaultValue={payment.description}
                  placeholder="Nuova descrizione..."
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={issubmitting}
                  className="px-4 py-2 text-xs font-semibold"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  loading={issubmitting}
                  loadingLabel="Salvataggio..."
                  className="h-10 px-5 text-sm font-semibold"
                >
                  Salva correzione
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
