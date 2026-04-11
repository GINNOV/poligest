"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  buildCrashSupportEmail,
  CRASH_CONTEXT_STORAGE_KEY,
  parseCrashContext,
  type CrashContextSnapshot,
} from "@/lib/crash-context";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "studio.agovino.angrisano@gmail.com";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Generate a stable fallback ID if digest is missing.
  const fallbackId = useMemo(
    () =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "ERR-UNKNOWN",
    []
  );
  const errorId = error.digest || fallbackId;
  const reportedRef = useRef(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [contextSummary] = useState<CrashContextSnapshot | null>(() =>
    typeof window === "undefined"
      ? null
      : parseCrashContext(window.sessionStorage.getItem(CRASH_CONTEXT_STORAGE_KEY)),
  );
  const recentBreadcrumbs = useMemo(
    () => contextSummary?.breadcrumbs.slice(-5) ?? [],
    [contextSummary],
  );
  const breadcrumbExport = useMemo(() => {
    if (recentBreadcrumbs.length === 0) return "";
    return [
      `Codice errore: ${errorId}`,
      "",
      "Ultimi passaggi rilevati:",
      ...recentBreadcrumbs.map((entry) => `${entry.at} · ${entry.type} · ${entry.detail}`),
    ].join("\n");
  }, [errorId, recentBreadcrumbs]);
  const supportHref = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : buildCrashSupportEmail({
            supportEmail: SUPPORT_EMAIL,
            errorCode: errorId,
            pagePath: window.location.pathname,
            snapshot: contextSummary,
          }),
    [contextSummary, errorId],
  );

  useEffect(() => {
    console.error("Unhandled app error", { digest: error.digest, error });
    if (reportedRef.current) return;
    reportedRef.current = true;

    const payload = {
      code: errorId,
      message: error.message,
      source: "global_error_boundary",
      path: window.location.pathname,
      context: contextSummary,
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
  }, [contextSummary, error, errorId]);

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const handleCopyBreadcrumbs = async () => {
    if (!breadcrumbExport) return;
    try {
      await navigator.clipboard.writeText(breadcrumbExport);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-14 text-center sm:px-6">
        <div className="inline-flex items-center justify-center self-center rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Errore di sistema
        </div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Qualcosa è andato storto</h1>
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
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Si è verificato un problema inatteso. Se il problema persiste, segnalalo al supporto tecnico usando il bottone in fondo alla pagina.
        </p>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Codice errore
          </p>
          <p className="mt-2 select-all text-lg font-mono font-semibold text-zinc-900 dark:text-zinc-50">{errorId}</p>
          {recentBreadcrumbs.length ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  Ultimi passaggi rilevati
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleCopyBreadcrumbs}
                  className="rounded-full border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {copyState === "copied"
                    ? "Copiato"
                    : copyState === "error"
                      ? "Copia non riuscita"
                      : "Copia"}
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {recentBreadcrumbs.map((entry) => (
                  <li key={`${entry.at}-${entry.detail}`}>
                    {entry.at} · {entry.type} · {entry.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={reset}
            className="rounded-full"
          >
            Riprova
          </Button>
          <Button asChild variant="outline" className="rounded-full border-zinc-200 dark:border-zinc-700"><Link href="/">Torna alla home</Link></Button>
          {supportHref ? (
            <Button asChild variant="outline" className="rounded-full border-emerald-200 hover:border-emerald-300 dark:border-emerald-800"><a href={supportHref}>Segnala a supporto tecnico</a></Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
