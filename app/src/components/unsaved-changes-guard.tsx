"use client";

import { useEffect, useRef } from "react";

type Props = {
  formId: string;
  message?: string;
};

const defaultMessage =
  "Hai modifiche non salvate. Vuoi davvero abbandonare la pagina?";

export function UnsavedChangesGuard({ formId, message = defaultMessage }: Props) {
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const submitTimeoutRef = useRef<number | null>(null);

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
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      dirtyRef.current = false;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [message]);

  return null;
}
