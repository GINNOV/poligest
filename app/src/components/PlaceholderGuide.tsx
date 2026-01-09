"use client";

import { useEffect, useState } from "react";
import type { PlaceholderDefinition } from "@/lib/placeholder-data";

type Props = {
  placeholders: PlaceholderDefinition[];
};

export function PlaceholderGuide({ placeholders }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Segnaposto
            </p>
            <h2 className="text-lg font-semibold text-zinc-900">Guida placeholder</h2>
            <p className="text-xs text-zinc-500">Usa Cmd/Ctrl + / per aprire o chiudere.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Chiudi
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <div className="space-y-3">
            {placeholders.map((item) => (
              <div key={item.key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900">{`{{${item.key}}}`}</span>
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                <p className="mt-1 text-xs text-zinc-500">Esempio: {item.example}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
