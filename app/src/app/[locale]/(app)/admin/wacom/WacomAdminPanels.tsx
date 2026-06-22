"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

type Props = {
  isConfigured: boolean;
  licenseKey: string;
  licenseSecret: string;
  licenseSource: "db" | "env" | null;
  sdkFilesPresent: boolean;
  isReady: boolean;
  saveAction: (formData: FormData) => Promise<void>;
};

function MaskedValue({
  value,
  configured,
}: {
  value: string;
  configured: boolean;
}) {
  const [visible, setVisible] = useState(false);

  if (!configured || !value) {
    return <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">—</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[12rem] truncate font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {visible ? value : "••••••••••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
      >
        {visible ? "Nascondi" : "Mostra"}
      </button>
    </div>
  );
}

function CredentialInput({
  name,
  label,
  configured,
  placeholder,
}: {
  name: string;
  label: string;
  configured: boolean;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
      {label}
      <div className="flex items-center gap-2">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={!configured}
          autoComplete="off"
          className="h-10 flex-1 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {visible ? "Nascondi" : "Mostra"}
        </button>
      </div>
    </label>
  );
}

export function WacomAdminPanels({
  isConfigured,
  licenseKey,
  licenseSecret,
  licenseSource,
  sdkFilesPresent,
  isReady,
  saveAction,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stato integrazione</span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isConfigured
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {isConfigured ? "Configurata" : "Non configurata"}
          </span>
        </div>

        <dl className="mt-4 space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <dt className="font-semibold">Chiave licenza</dt>
            <dd>
              <MaskedValue value={licenseKey} configured={isConfigured} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <dt className="font-semibold">Secret licenza</dt>
            <dd>
              <MaskedValue value={licenseSecret} configured={isConfigured} />
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <dt className="font-semibold">Origine</dt>
            <dd className="text-xs text-zinc-600 dark:text-zinc-400">
              {licenseSource === "db"
                ? "Database"
                : licenseSource === "env"
                  ? "Variabili ambiente (fallback)"
                  : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <dt className="font-semibold">SDK in /public/wacom</dt>
            <dd
              className={`text-xs font-semibold ${sdkFilesPresent ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
            >
              {sdkFilesPresent ? "Presente" : "Mancante"}
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

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {isConfigured ? "Aggiorna licenza Wacom" : "Configura licenza Wacom"}
        </p>
        <form className="space-y-3" action={saveAction}>
          <CredentialInput
            name="licenseKey"
            label="License key"
            configured={isConfigured}
            placeholder={isConfigured ? "Lascia vuoto per non modificare" : "Chiave licenza Wacom"}
          />
          <CredentialInput
            name="licenseSecret"
            label="License secret"
            configured={isConfigured}
            placeholder={isConfigured ? "Lascia vuoto per non modificare" : "Secret licenza Wacom"}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isConfigured
              ? "Compila solo i campi che vuoi aggiornare. Le credenziali vengono salvate nel database e usate subito."
              : "Le credenziali vengono salvate nel database e usate subito per le firme. Nessun riavvio necessario."}
          </p>
          <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
            {isConfigured ? "Aggiorna configurazione" : "Salva configurazione"}
          </FormSubmitButton>
        </form>
      </div>
    </div>
  );
}