"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export type ToastVariant = "success" | "error" | "info";

export type ToastMeta = {
  code?: string;
  detail?: string;
  path?: string;
  source?: string;
};

export type Toast = {
  id: number;
  message: string;
  variant?: ToastVariant;
} & ToastMeta;

type EmitToastOptions = ToastMeta;

let toastId = 0;

export function formatToastReportText(toast: Toast) {
  const lines = [toast.message];
  if (toast.code) lines.push(`Codice: ${toast.code}`);
  if (toast.path) lines.push(`Percorso: ${toast.path}`);
  if (toast.detail) lines.push(`Dettaglio: ${toast.detail}`);
  if (toast.source) lines.push(`Sorgente: ${toast.source}`);
  return lines.join("\n");
}

export function emitToast(
  message: string,
  variant: ToastVariant = "info",
  options?: EmitToastOptions,
) {
  if (typeof document === "undefined") return;
  const detail: Toast = {
    id: ++toastId,
    message,
    variant,
    code: options?.code,
    detail: options?.detail,
    path: options?.path,
    source: options?.source,
  };
  document.dispatchEvent(new CustomEvent("app:toast", { detail }));
}

function ToastActions({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = useCallback(async () => {
    const text = formatToastReportText(toast);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [toast]);

  if (toast.variant !== "error") return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-zinc-950 dark:text-rose-200 dark:hover:bg-rose-950/60"
      >
        {copyState === "copied" ? "Copiato" : copyState === "failed" ? "Copia non riuscita" : "Copia dettagli"}
      </button>
      {toast.code ? (
        <a
          href={`/admin/errori?q=${encodeURIComponent(toast.code)}`}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Vedi in registro
        </a>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full border border-transparent px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100/80 dark:text-rose-300 dark:hover:bg-rose-950/40"
      >
        Chiudi
      </button>
    </div>
  );
}

export function GlobalToasts() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Toast>;
      if (!custom.detail) return;
      setToasts((prev) => [...prev, custom.detail]);
    };
    document.addEventListener("app:toast", handler);
    return () => document.removeEventListener("app:toast", handler);
  }, []);

  useEffect(() => {
    const transientToasts = toasts.filter((toast) => toast.variant !== "error");
    if (transientToasts.length === 0) return;

    const timers = transientToasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 3600),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-x-0 top-4 z-[99999] flex flex-col items-center space-y-2 px-4 sm:items-end sm:space-y-3 sm:px-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          aria-live={toast.variant === "error" ? "assertive" : "polite"}
          className={clsx(
            "w-full max-w-md rounded-xl border px-4 py-3 shadow-lg shadow-emerald-900/5 transition sm:w-auto",
            toast.variant === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-200",
            toast.variant === "error" &&
              "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950 dark:text-rose-200",
            toast.variant === "info" &&
              "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          )}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl" aria-hidden="true">
              {toast.variant === "success" ? "✅" : toast.variant === "error" ? "⚠️" : "ℹ️"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{toast.message}</p>
              {toast.code ? (
                <p className="mt-2 font-mono text-xs text-rose-800 dark:text-rose-200">
                  Codice: {toast.code}
                </p>
              ) : null}
              {toast.detail ? (
                <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-200/90">{toast.detail}</p>
              ) : null}
              {toast.path ? (
                <p className="mt-1 truncate text-xs text-rose-700/80 dark:text-rose-300/80">{toast.path}</p>
              ) : null}
              <ToastActions toast={toast} onDismiss={() => dismissToast(toast.id)} />
            </div>
            {toast.variant === "error" ? (
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Chiudi notifica errore"
                className="rounded-full p-1 text-rose-700 transition hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950/60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}