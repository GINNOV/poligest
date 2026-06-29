"use client";

import { useCallback, useState } from "react";
import {
  formatErrorRecordForCopy,
  type NormalizedErrorRecord,
} from "@/lib/error-registry";

type ErrorLogCardProps = {
  entry: NormalizedErrorRecord;
  formattedDate: string;
  contextPreview: string | null;
};

const codeKindStyles = {
  support: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  next_digest: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  audit_id: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
} as const;

export function ErrorLogCard({ entry, formattedDate, contextPreview }: ErrorLogCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatErrorRecordForCopy(entry));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [entry]);

  const stackLine = entry.errorStack?.split("\n")[0] ?? null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${codeKindStyles[entry.codeKind]}`}
            >
              {entry.codeKindLabel}
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {entry.areaLabel}
            </span>
          </div>
          <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{entry.supportCode}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.areaDescription}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{formattedDate}</p>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {copyState === "copied" ? "Copiato" : copyState === "failed" ? "Copia non riuscita" : "Copia errore"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{entry.message}</p>

      {entry.errorHuman ? (
        <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">Dettaglio: {entry.errorHuman}</p>
      ) : null}
      {entry.errorName ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Tipo: {entry.errorName}</p>
      ) : null}
      {entry.errorDigest && entry.errorDigest !== entry.supportCode ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Digest Next.js: <span className="font-mono">{entry.errorDigest}</span>
        </p>
      ) : null}
      {stackLine ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Stack: {stackLine}</p>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Sorgente: {entry.source ?? "—"}
        {" · "}
        Percorso: {entry.path ?? "—"}
      </p>
      {contextPreview ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Contesto: {contextPreview}</p>
      ) : null}
      {entry.actor ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Utente: {entry.actor}
          {entry.role ? ` (${entry.role})` : ""}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">ID registro: {entry.id}</p>
    </div>
  );
}