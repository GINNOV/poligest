"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "./ui/button";

type Props = {
  action: (formData: FormData) => Promise<void>;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  cancelText?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg";
  formId?: string;
  name?: string;
  value?: string;
  data?: Record<string, string>;
  title?: string;
};

/**
 * A reusable Client Component that handles server actions with a custom confirmation dialog.
 * Use this in Server Components when you need to trigger an action with confirmation.
 */
export function ConfirmButton({
  action,
  confirmTitle = "Conferma azione",
  confirmMessage = "Sei sicuro di voler procedere?",
  confirmText = "Conferma",
  cancelText = "Annulla",
  children,
  className,
  variant = "primary",
  size,
  name,
  value,
  data,
  title,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

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

  const handleConfirm = () => {
    setShowConfirm(false);
    startTransition(async () => {
      try {
        const formData = new FormData();
        if (name && value) {
          formData.append(name, value);
        }
        if (data) {
          Object.entries(data).forEach(([k, v]) => formData.append(k, v));
        }
        await action(formData);
      } catch (error) {
        console.error("Action failed:", error);
        alert(error instanceof Error ? error.message : "Si è verificato un errore inaspettato.");
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setShowConfirm(true)}
        loading={isPending}
        className={className}
        variant={variant}
        size={size}
        title={title}
      >
        {children}
      </Button>

      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="mb-3 text-center text-lg font-semibold text-rose-700 dark:text-rose-400">{confirmTitle}</div>
            <p className="text-sm text-center text-zinc-700 dark:text-zinc-300">{confirmMessage}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
