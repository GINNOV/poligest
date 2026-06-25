"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
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

function useManagedFormAction(action: (formData: FormData) => Promise<WhatsAppAdminFormState>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<WhatsAppAdminFormState | null>(null);

  const runAction = () => {
    const form = formRef.current;
    if (!form || pending) return;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      setState(result);
    });
  };

  const handleEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    runAction();
  };

  return { formRef, pending, state, runAction, handleEnter };
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
  const { formRef, pending, state, runAction, handleEnter } = useManagedFormAction(saveAction);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Aggiorna credenziali</p>
      <form
        ref={formRef}
        className="space-y-3"
        data-managed-submit="true"
        onKeyDown={handleEnter}
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
        <Button
          type="button"
          loading={pending}
          loadingLabel="Salvataggio..."
          onClick={runAction}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Salva configurazione
        </Button>
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
  const { formRef, pending, state, runAction, handleEnter } = useManagedFormAction(sendTestAction);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invio di test</p>
      <form
        ref={formRef}
        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1.4fr,auto] md:items-end"
        data-managed-submit="true"
        onKeyDown={handleEnter}
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
        <Button
          type="button"
          loading={pending}
          loadingLabel="Invio..."
          onClick={runAction}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Invia test WhatsApp
        </Button>
      </form>
      <FormFeedback state={state} />
    </div>
  );
}