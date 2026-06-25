"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { WhatsAppAdminFormState } from "@/lib/admin/whatsapp-actions";

const inputClassName =
  "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900";

function FormFeedback({ state }: { state: WhatsAppAdminFormState | null }) {
  if (!state?.error && !state?.success) return null;

  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
        {state.error}
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
      Operazione completata.
    </p>
  );
}

type WhatsAppConfigFormProps = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  hasStoredApiKey: boolean;
  saveAction: (formData: FormData) => Promise<WhatsAppAdminFormState>;
};

export function WhatsAppConfigForm({
  phoneNumberId,
  displayPhoneNumber,
  hasStoredApiKey,
  saveAction,
}: WhatsAppConfigFormProps) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<WhatsAppAdminFormState | null>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Aggiorna credenziali</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await saveAction(formData);
            setState(result);
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Token API Kapso
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={hasStoredApiKey ? "Lascia vuoto per mantenere il token attuale" : "Token da Kapso"}
            className={inputClassName}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          ID numero WhatsApp
          <input
            name="phoneNumberId"
            defaultValue={phoneNumberId}
            required
            className={inputClassName}
            placeholder="es. 597907523413541"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Numero WhatsApp (opzionale)
          <input
            name="displayPhoneNumber"
            defaultValue={displayPhoneNumber}
            className={inputClassName}
            placeholder="+39..."
          />
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          L&apos;ID numero è il valore <code className="font-mono">phone_number_id</code> restituito da Kapso.
          Il numero visualizzato serve solo come riferimento per lo staff.
        </p>
        <FormSubmitButton
          loading={pending}
          pendingLabel="Salvataggio..."
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Salva configurazione
        </FormSubmitButton>
        <FormFeedback state={state} />
      </form>
      <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
        I richiami automatici in <Link href="/richiami/regole" className="font-semibold underline">Regole automatiche</Link>{" "}
        useranno questa integrazione quando il canale è WhatsApp.
      </p>
    </div>
  );
}

type WhatsAppTestFormProps = {
  sendTestAction: (formData: FormData) => Promise<WhatsAppAdminFormState>;
};

export function WhatsAppTestForm({ sendTestAction }: WhatsAppTestFormProps) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<WhatsAppAdminFormState | null>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invio di test</p>
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1.4fr,auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await sendTestAction(formData);
            setState(result);
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Numero di destinazione
          <input name="to" required className={inputClassName} placeholder="+39..." />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Testo (opzionale)
          <input
            name="body"
            className={inputClassName}
            placeholder="Messaggio di test dal pannello WhatsApp Kapso."
          />
        </label>
        <FormSubmitButton
          loading={pending}
          pendingLabel="Invio..."
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Invia test WhatsApp
        </FormSubmitButton>
      </form>
      <FormFeedback state={state} />
    </div>
  );
}