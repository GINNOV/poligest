"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";
import { emitToast } from "./global-toasts";

export function ProductDeleteButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const close = () => {
    setShowConfirm(false);
    setConfirmation("");
  };

  const onDelete = async () => {
    if (isSubmitting) return;
    setShowConfirm(false);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-destructive-intent": "delete",
          "x-confirm-resource-id": productId,
          "x-delete-confirmation": confirmation.trim(),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Eliminazione non riuscita");
      }
      emitToast("Prodotto eliminato", "success");
      router.refresh();
    } catch (error) {
      console.error("[product-delete] failed", error);
      emitToast("Impossibile eliminare il prodotto", "error");
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
        className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-700 transition hover:bg-rose-50 hover:text-rose-800 disabled:pointer-events-none disabled:opacity-70 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      >
        <span className="sr-only">Elimina prodotto</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M7 2a2 2 0 00-2 2v1H3.5a.5.5 0 000 1h13a.5.5 0 000-1H15V4a2 2 0 00-2-2H7zm6 3V4a1 1 0 00-1-1H8a1 1 0 00-1 1v1h6zm-8 2a.5.5 0 01.5-.5h9a.5.5 0 01.5.5v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7zm2.5.5a.5.5 0 00-1 0v7a.5.5 0 001 0v-7zm3 0a.5.5 0 10-1 0v7a.5.5 0 001 0v-7zm2.5 0a.5.5 0 00-1 0v7a.5.5 0 001 0v-7z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {showConfirm ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="mb-3 text-center text-lg font-semibold text-rose-700 dark:text-rose-400">Conferma azione</div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Confermi l&apos;eliminazione definitiva del prodotto e dei movimenti collegati?
            </p>
            <label className="mt-4 flex flex-col gap-2 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Digita <span className="font-semibold dark:text-zinc-50">{DELETE_CONFIRMATION_TEXT}</span> per continuare
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={DELETE_CONFIRMATION_TEXT}
                autoComplete="off"
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-900/40"
              />
            </label>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isSubmitting || confirmation.trim() !== DELETE_CONFIRMATION_TEXT}
                className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900 disabled:cursor-not-allowed disabled:opacity-80"
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
