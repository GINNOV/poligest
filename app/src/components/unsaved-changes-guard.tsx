"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  formId: string;
  message?: string;
};

const defaultMessage =
  "Hai modifiche non salvate. Vuoi davvero abbandonare la pagina?";

export function UnsavedChangesGuard({ formId, message = defaultMessage }: Props) {
  const router = useRouter();
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const submitTimeoutRef = useRef<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const setDirty = (dirty: boolean) => {
      dirtyRef.current = dirty;
    };

    const handleInput = () => setDirty(true);
    const handleSubmit = () => {
      submittingRef.current = true;
      if (submitTimeoutRef.current) {
        window.clearTimeout(submitTimeoutRef.current);
      }
      submitTimeoutRef.current = window.setTimeout(() => {
        submittingRef.current = false;
      }, 4000);
    };
    const handleReset = () => {
      setDirty(false);
      submittingRef.current = false;
      if (submitTimeoutRef.current) {
        window.clearTimeout(submitTimeoutRef.current);
      }
    };

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
    const shouldBlock = () => dirtyRef.current && !submittingRef.current;

    const handleSkip = () => {
      dirtyRef.current = false;
      submittingRef.current = false;
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlock()) return;
      event.preventDefault();
      event.returnValue = message;
    };

    const handleClick = (event: MouseEvent) => {
      if (!shouldBlock()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.getAttribute("data-skip-unsaved-guard") === "true") return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(anchor.href);
      setShowConfirm(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unsaved-guard:skip", handleSkip as EventListener);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unsaved-guard:skip", handleSkip as EventListener);
      document.removeEventListener("click", handleClick, true);
    };
  }, [message]);

  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setShowConfirm(false);
        setPendingHref(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  const confirmLeave = () => {
    if (!pendingHref) {
      setShowConfirm(false);
      return;
    }
    window.dispatchEvent(new Event("unsaved-guard:skip"));
    const targetUrl = new URL(pendingHref, window.location.origin);
    if (targetUrl.origin === window.location.origin) {
      router.push(targetUrl.pathname + targetUrl.search + targetUrl.hash);
    } else {
      window.location.assign(pendingHref);
    }
  };

  return showConfirm ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 text-center text-lg font-semibold text-rose-700">Conferma azione</div>
        <p className="text-sm text-zinc-700">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setPendingHref(null);
            }}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  ) : null;
}
