"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emitToast } from "./global-toasts";

export function PatientDeleteButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const close = () => setShowConfirm(false);

  const onDelete = async () => {
    if (isSubmitting) return;

    setShowConfirm(false);

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Eliminazione non riuscita");
      }

      emitToast("Paziente eliminato", "success");
      router.refresh();
    } catch (error) {
      console.error("[patient-delete] failed", error);
      emitToast("Impossibile eliminare il paziente", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSubmitting}
        className="rounded-full border border-rose-200 px-3 py-1 text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:pointer-events-none disabled:opacity-70"
      >
        Elimina
      </button>
      {showConfirm ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-3 text-center text-lg font-semibold text-rose-700">Conferma azione</div>
          <p className="text-sm text-zinc-700">
            Confermi l&apos;eliminazione definitiva del paziente e di tutti i dati collegati?
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              Conferma
            </button>
          </div>
        </div>
      </div>
      ) : null}
    </>
  );
}
