"use client";

import { useState } from "react";

type Props = {
  apiKey: string;
};

export function ScanIdClient({ apiKey }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Chiave API per ScanID</span>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Copia questa chiave e incollala nelle preferenze dell&apos;applicazione ScanID per macOS (Tab Sorriso) per autorizzare la creazione dei pazienti.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 select-all rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-950 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-700 overflow-x-auto whitespace-pre">
            {apiKey}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {copied ? "Copiato!" : "Copia"}
          </button>
        </div>
      </div>
    </div>
  );
}
