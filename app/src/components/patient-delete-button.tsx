"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";
import { emitToast } from "./global-toasts";

export function PatientDeleteButton({ patientId, role }: { patientId: string; role?: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  if (role === Role.SECRETARY) {
    return null;
  }

  const close = () => {
    setShowConfirm(false);
    setConfirmation("");
  };

  const onDelete = async () => {
    if (isSubmitting) return;

    setShowConfirm(false);

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-destructive-intent": "delete",
          "x-confirm-resource-id": patientId,
          "x-delete-confirmation": confirmation.trim(),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Eliminazione non riuscita");
      }

      emitToast("Paziente eliminato", "success");
      router.replace("/pazienti");
    } catch (error) {
      console.error("[patient-delete] failed", error);
      emitToast("Impossibile eliminare il paziente", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

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
  }, [showConfirm]);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSubmitting}
        className="rounded-full border border-rose-200 px-4 py-1 text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:pointer-events-none disabled:opacity-70 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      >
        Elimina
      </button>
      {showConfirm ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
          <div className="mb-3 text-center text-lg font-semibold text-rose-700 dark:text-rose-400">Conferma azione</div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Confermi l&apos;eliminazione definitiva del paziente e di tutti i dati collegati?
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
              onClick={onDelete}
              disabled={isSubmitting || confirmation.trim() !== DELETE_CONFIRMATION_TEXT}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-80 dark:focus:ring-rose-900"
            >
              {isSubmitting ? (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white"
                />
              ) : null}
              Conferma
            </button>
          </div>
        </div>
      </div>
      ) : null}
      {isSubmitting ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-zinc-700 shadow-xl dark:bg-zinc-950 dark:text-zinc-200">
            Eliminazione in corso...
          </div>
        </div>
      ) : null}
    </>
  );
}
