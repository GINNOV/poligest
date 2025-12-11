"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

type Toast = {
  id: number;
  message: string;
  variant?: "success" | "error" | "info";
};

let toastId = 0;

export function emitToast(message: string, variant: Toast["variant"] = "info") {
  if (typeof document === "undefined") return;
  const detail: Toast = { id: ++toastId, message, variant };
  document.dispatchEvent(new CustomEvent("app:toast", { detail }));
}

export function GlobalToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Toast>;
      if (!custom.detail) return;
      setToasts((prev) => [...prev, custom.detail]);
    };
    document.addEventListener("app:toast", handler);
    return () => document.removeEventListener("app:toast", handler);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3600)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [toasts]);

  if (typeof document === "undefined") return null;
  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 top-4 z-[99999] flex flex-col items-center space-y-2 px-4 sm:items-end sm:space-y-3 sm:px-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "flex min-w-[240px] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-emerald-900/5 transition",
            toast.variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
            toast.variant === "error" && "border-rose-200 bg-rose-50 text-rose-900",
            toast.variant === "info" && "border-zinc-200 bg-white text-zinc-900"
          )}
        >
          <span className="text-xl" aria-hidden="true">
            {toast.variant === "success" ? "✅" : toast.variant === "error" ? "⚠️" : "ℹ️"}
          </span>
          <p className="text-sm font-semibold leading-snug">{toast.message}</p>
        </div>
      ))}
    </div>,
    document.body
  );
}
