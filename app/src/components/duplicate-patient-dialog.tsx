"use client";

import Link from "next/link";

type DuplicatePatient = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

type Props = {
  patient: DuplicatePatient;
  onClose: () => void;
  /**
   * When set (e.g. appointment booking), staff can attach the existing scheda
   * and continue the current flow without creating a second record.
   */
  onUseExisting?: () => void;
  useExistingLabel?: string;
};

export function DuplicatePatientDialog({
  patient,
  onClose,
  onUseExisting,
  useExistingLabel = "Usa scheda e continua",
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">Paziente già esistente</h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Esiste già una scheda con questi dati:{" "}
          <span className="font-bold text-zinc-900 dark:text-zinc-50">
            {patient.lastName} {patient.firstName}
            {patient.phone ? ` (${patient.phone})` : ""}
          </span>
          .
          {onUseExisting
            ? " Puoi usare la scheda esistente e continuare, oppure aprirla per verificare."
            : " Non è possibile crearne una seconda: apri la scheda esistente o correggi i dati inseriti."}
        </p>
        <div className="grid grid-cols-1 gap-3">
          {onUseExisting ? (
            <button
              type="button"
              onClick={onUseExisting}
              className="flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              {useExistingLabel}
            </button>
          ) : null}
          <Link
            href={`/pazienti/${patient.id}`}
            className={`flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              onUseExisting
                ? "border border-zinc-200 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-600"
            }`}
          >
            Vai alla scheda
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla e correggi
          </button>
        </div>
      </div>
    </div>
  );
}
