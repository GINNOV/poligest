"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  formId: string;
  href: string;
  label: string;
  className?: string;
  message?: string;
};

const defaultMessage =
  "Hai modifiche non salvate. Vuoi davvero abbandonare la pagina?";

export function ConfirmLeaveButton({ formId, href, label, className, message = defaultMessage }: Props) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const handleInput = () => setIsDirty(true);
    const handleSubmit = () => setIsDirty(false);
    const handleReset = () => setIsDirty(false);

    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("reset", handleReset);

    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener("reset", handleReset);
    };
  }, [formId]);

  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setShowConfirm(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  const onClick = () => {
    if (!isDirty) {
      router.push(href);
      return;
    }
    setShowConfirm(true);
  };

  return (
    <>
      <button type="button" onClick={onClick} className={className}>
        {label}
      </button>
      {showConfirm ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 text-center text-lg font-semibold text-rose-700">
              Conferma azione
            </div>
            <p className="text-sm text-zinc-700">{message}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("unsaved-guard:skip"));
                  router.push(href);
                }}
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
