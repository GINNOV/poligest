"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";
import { emitToast } from "@/components/global-toasts";

type Props = {
  safeGroupCount: number;
};

export function PatientDuplicateBulkMergeButton({ safeGroupCount }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const close = useCallback(() => {
    if (isSubmitting) return;
    setShowConfirm(false);
    setConfirmation("");
  }, [isSubmitting]);

  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, showConfirm]);

  const onBulkMerge = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/patients/duplicates/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "safe_all",
          confirmation: confirmation.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Operazione non riuscita");
      }

      const body = await res.json().catch(() => ({}));
      const merged = typeof body?.merged === "number" ? body.merged : safeGroupCount;
      emitToast(
        merged > 0 ? `Uniti ${merged} gruppi di schede vuote` : "Nessun gruppo unito",
        "success",
      );
      setShowConfirm(false);
      setConfirmation("");
      router.refresh();
    } catch (error) {
      console.error("[duplicate-patient-bulk-merge] failed", error);
      emitToast("Impossibile unire tutti i gruppi sicuri", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (safeGroupCount <= 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSubmitting}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-70 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
      >
        Unisci tutti i gruppi sicuri ({safeGroupCount})
      </button>
      {showConfirm ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="mb-3 text-center text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              Conferma unione di massa
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Verranno uniti {safeGroupCount} gruppi sicuri: per ciascuno si completano i campi
              mancanti della scheda da mantenere e si eliminano le schede vuote. I gruppi con dati
              collegati non verranno toccati.
            </p>
            <label className="mt-4 flex flex-col gap-2 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Digita <span className="font-semibold">{DELETE_CONFIRMATION_TEXT}</span> per continuare
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={DELETE_CONFIRMATION_TEXT}
                autoComplete="off"
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-800"
              />
            </label>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={close}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={onBulkMerge}
                disabled={isSubmitting || confirmation.trim() !== DELETE_CONFIRMATION_TEXT}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-80 dark:focus:ring-emerald-900"
              >
                {isSubmitting ? (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white"
                  />
                ) : null}
                Conferma unione
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
