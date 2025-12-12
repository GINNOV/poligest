"use client";

import { useEffect, useMemo, useState } from "react";

type PendingSubmit = {
  form: HTMLFormElement;
  submitter?: HTMLElement;
  message: string;
};

// Globally intercepts submissions with data-confirm and shows a branded dialog.
export function ConfirmBeforeSubmit() {
  const [pending, setPending] = useState<PendingSubmit | null>(null);
  const confirmedSubmissions = useMemo(() => new WeakSet<HTMLFormElement>(), []);

  useEffect(() => {
    const handler = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;

      // Skip if we already confirmed this specific form submission.
      if (confirmedSubmissions.has(form)) {
        confirmedSubmissions.delete(form);
        return;
      }

      const submitter = (event as unknown as { submitter?: HTMLElement }).submitter;
      const message =
        submitter?.getAttribute?.("data-confirm") ?? form.getAttribute("data-confirm");

      if (!message) return;

      event.preventDefault();
      event.stopPropagation();
      setPending({ form, submitter: submitter ?? undefined, message });
    };

    document.addEventListener("submit", handler as EventListener, true);
    return () => {
      document.removeEventListener("submit", handler as EventListener, true);
    };
  }, [confirmedSubmissions]);

  const onConfirm = () => {
    if (!pending) return;
    confirmedSubmissions.add(pending.form);
    pending.form.requestSubmit(pending.submitter as HTMLButtonElement | undefined);
    setPending(null);
  };

  const onCancel = () => setPending(null);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 text-center text-lg font-semibold text-rose-700">Conferma azione</div>
        <p className="text-sm text-zinc-700">{pending.message}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
