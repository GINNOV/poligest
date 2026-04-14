"use client";

import { useEffect } from "react";

type ConflictDialogProps = {
  message: string;
  onClose: () => void;
  onProceed?: () => void;
  actionLabel?: string;
  proceedLabel?: string;
};

export function ConflictDialog({ 
  message, 
  onClose, 
  onProceed, 
  actionLabel = "Annulla", 
  proceedLabel = "Procedi comunque" 
}: ConflictDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
        <div className="mb-3 text-center text-lg font-semibold text-rose-700 dark:text-rose-400">
          {onProceed ? "Attenzione" : "Conflitto orario"}
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {onProceed ? actionLabel : "Chiudi"}
          </button>
          {onProceed && (
            <button
              type="button"
              onClick={onProceed}
              className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900"
            >
              {proceedLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
