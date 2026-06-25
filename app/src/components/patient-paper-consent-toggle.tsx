"use client";

import { useState, useTransition } from "react";
import { updatePaperConsentAction } from "@/lib/patients/actions";

type Props = {
  patientId: string;
  defaultChecked: boolean;
};

export function PatientPaperConsentToggle({ patientId, defaultChecked }: Props) {
  const [checked, setChecked] = useState(defaultChecked);
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setChecked(next);
    const formData = new FormData();
    formData.set("patientId", patientId);
    if (next) {
      formData.set("hasPaperConsentForRequired", "on");
    }
    startTransition(async () => {
      await updatePaperConsentAction(formData);
    });
  };

  return (
    <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={isPending}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span>
        Firma esiste su scheda cartacea per moduli obbligatori.
      </span>
    </label>
  );
}