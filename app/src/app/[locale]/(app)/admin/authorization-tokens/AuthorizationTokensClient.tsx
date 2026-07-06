"use client";

import { useState } from "react";

type AuthorizationTokensClientProps = {
  readonly sorrisoApiToken: string;
};

export function AuthorizationTokensClient({ sorrisoApiToken }: AuthorizationTokensClientProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToken = async (tokenName: string, token: string) => {
    await navigator.clipboard.writeText(token);
    setCopiedToken(tokenName);
    window.setTimeout(() => setCopiedToken(null), 2000);
  };

  const isCopied = copiedToken === "sorriso-api";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sorriso API</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                ScanID
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                QuickNotes
              </span>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            Attivo
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-pre rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
            {sorrisoApiToken}
          </code>
          <button
            type="button"
            onClick={() => {
              void copyToken("sorriso-api", sorrisoApiToken);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:ring-emerald-900"
          >
            {isCopied ? "Copiato" : "Copia"}
          </button>
        </div>
      </div>
    </div>
  );
}
