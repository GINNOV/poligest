"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { renderUpdateMarkdown } from "@/components/feature-update-markdown";

type Props = {
  update: { id: string; title: string; bodyMarkdown: string };
};

export function StaffFeatureUpdateDialog({ update }: Props) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const content = useMemo(() => renderUpdateMarkdown(update.bodyMarkdown), [update.bodyMarkdown]);
  const dismiss = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feature-updates/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ updateId: update.id }),
      });
    } catch (error) {
      console.error("Failed to dismiss feature update", error);
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  }, [submitting, update.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white p-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Novità
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-zinc-900">{update.title}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Questo messaggio verrà mostrato una sola volta.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Chiudi
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">{content}</div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 p-4">
          <button
            type="button"
            onClick={dismiss}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Salvataggio..." : "Ho capito"}
          </button>
        </div>
      </div>
    </div>
  );
}
