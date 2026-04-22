"use client";

import { usePaymentState } from "./payment-state-provider";
import { PatientPaymentFields } from "@/components/finance-forms";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

export function PaymentRegistrationForm({
  patientId,
  quoteId,
  diarioUrl,
  recordPatientPaymentAction,
  doctors,
}: {
  patientId: string;
  quoteId: string;
  diarioUrl: string;
  recordPatientPaymentAction: (formData: FormData) => Promise<void>;
  doctors: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const { items, openAccordion, setOpenAccordion } = usePaymentState();
  const unsettledItems = items.filter((item) => item.remaining > 0);

  const [state, formAction] = useActionState(
    async (_: any, formData: FormData) => {
      await recordPatientPaymentAction(formData);
      return { success: true, timestamp: Date.now() };
    },
    { success: false, timestamp: 0 }
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.timestamp, state.success, router]);

  return (
    <details
      open={openAccordion === "payment"}
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) {
          setOpenAccordion("payment");
        } else if (openAccordion === "payment") {
          setOpenAccordion(null);
        }
      }}
      className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600 dark:text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              REGISTRA INCASSO
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">3 - AGGIUNGI INCASSO</h2>
          </div>
        </div>
        <svg
          className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="p-6">
        {unsettledItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Tutte le prestazioni del preventivo risultano saldate.
          </div>
        ) : (
          <form action={formAction} className="space-y-3 text-sm">
            <PatientPaymentFields
              patientId={patientId}
              quoteId={quoteId}
              quoteItems={unsettledItems}
              diarioUrl={diarioUrl}
              doctors={doctors}
            />
            <FormSubmitButton variant="primary" className="w-full rounded-full shadow-sm">
              Registra incasso
            </FormSubmitButton>
          </form>
        )}
      </div>
    </details>
  );
}
