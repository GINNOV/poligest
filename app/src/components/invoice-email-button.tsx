"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { invoiceSendConfirmMessage } from "@/lib/finance/invoices";

const MISSING_EMAIL_MESSAGE = "Aggiungi un'email in anagrafica per inviare la fattura.";

export function InvoiceEmailButton({
  action,
  invoiceId,
  invoiceNumber,
  patientName,
  email,
}: {
  action: (formData: FormData) => Promise<void>;
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  email: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);
  const address = email.trim();
  const missing = address.length === 0;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Esc") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <form
      ref={formRef}
      action={missing ? undefined : action}
      className="space-y-2 print:hidden"
      onSubmit={(event) => {
        if (!missing && confirmed.current) return;
        event.preventDefault();
        setOpen(true);
      }}
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" variant="secondary">
        Invia al paziente
      </Button>
      {missing ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{MISSING_EMAIL_MESSAGE}</p> : null}
      {open ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-email-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950"
          >
            <div id="invoice-email-title" className="mb-3 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {missing ? "Email mancante" : "Invia fattura"}
            </div>
            <p className="text-center text-sm text-zinc-700 dark:text-zinc-300">
              {missing ? MISSING_EMAIL_MESSAGE : invoiceSendConfirmMessage(invoiceNumber, patientName, address)}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {missing ? "Chiudi" : "Annulla"}
              </button>
              {missing ? null : (
                <button
                  type="button"
                  onClick={() => {
                    confirmed.current = true;
                    setOpen(false);
                    formRef.current?.requestSubmit();
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Invia fattura
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
