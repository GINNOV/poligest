"use client";

import clsx from "clsx";
import { PrintLinkButton } from "@/components/print-link-button";

interface QuoteHeaderProps {
  patientId: string;
  initialQuoteId?: string | null;
  isDirty: boolean;
  printHref?: string | null;
}

export function QuoteHeader({
  patientId,
  initialQuoteId,
  isDirty,
  printHref,
}: QuoteHeaderProps) {
  return (
    <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
      <span className="flex items-center gap-3">
        <svg
          className="h-8 w-8 text-emerald-600 dark:text-emerald-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1 .5-1.5 1-2V5h-2Z" />
          <path d="M7 12h.01" />
          <path d="M11 20h2" />
        </svg>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 uppercase">
            1 - DETTAGLIO FINANZIARIO
          </h2>
        </div>
      </span>
      <div className="flex items-center gap-2">
        {initialQuoteId ? (
          <PrintLinkButton
            href={printHref || `/pazienti/${patientId}/preventivo/${initialQuoteId}`}
            label="Stampa preventivo"
            title={isDirty ? "Stampa (salva per includere le modifiche recenti)" : "Stampa preventivo"}
            target="_blank"
            rel="noreferrer"
            className={clsx(
              "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
              isDirty
                ? "border-amber-200 text-amber-600 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/20"
                : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400"
            )}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9V4h12v5" />
              <path d="M6 18h12v2H6z" />
              <path d="M6 14h12v4H6z" />
              <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
              <path d="M2 15h4" />
            </svg>
          </PrintLinkButton>
        ) : null}
        <svg
          className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </summary>
  );
}
