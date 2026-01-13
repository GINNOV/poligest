"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Generate a stable fallback ID if digest is missing.
  const fallbackId = useMemo(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  }, []);
  const errorId = error.digest || fallbackId;
  const reportedRef = useRef(false);

  useEffect(() => {
    console.error("Unhandled app error", { digest: error.digest, error });
    if (reportedRef.current) return;
    reportedRef.current = true;

    const payload = {
      code: errorId,
      message: error.message,
      source: "global_error_boundary",
      path: window.location.pathname,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        cause: (error as Error & { cause?: unknown }).cause,
      },
    };
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/errors/report", body);
      return;
    }

    fetch("/api/errors/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-screen bg-emerald-50 text-zinc-900">
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-14 text-center sm:px-6">
        <div className="inline-flex items-center justify-center self-center rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
          Errore di sistema
        </div>
        <h1 className="text-3xl font-semibold text-zinc-900">Qualcosa è andato storto</h1>
        <div className="flex justify-center">
          <Image
            src="/errors/crash.png"
            alt="Errore applicazione"
            width={360}
            height={240}
            className="h-auto w-72 sm:w-80"
            priority
          />
        </div>
        <p className="text-sm leading-6 text-zinc-600">
          Si è verificato un problema inatteso. Se il problema persiste, contatta il supporto e
          comunica il codice sottostante così possiamo cercarlo nei log.
        </p>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Codice errore
          </p>
          <p className="mt-2 select-all text-lg font-mono font-semibold text-zinc-900">{errorId}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Riprova
          </button>
          <a
            href="/"
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Torna alla home
          </a>
        </div>
      </main>
    </div>
  );
}
