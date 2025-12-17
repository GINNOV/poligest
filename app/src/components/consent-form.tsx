"use client";

import { useState, useMemo } from "react";
import { CONSENT_TYPES, type ConsentType } from "@/lib/client-enums";
import { addConsentAction } from "@/app/_actions/consent";
import { PatientConsentSection } from "@/components/patient-consent-modal";
import { FormSubmitButton } from "@/components/form-submit-button";

type Props = {
  patientId: string;
  typeLabels: Record<string, string>;
  typeContents: Record<string, string>;
  existingTypes: ConsentType[];
};

const CHANNELS = ["Di persona", "Telefono", "Manuale", "Digitale"];
const DEFAULT_CONSENT_TYPE: ConsentType = "PRIVACY";

export function ConsentForm({ patientId, typeLabels, typeContents, existingTypes }: Props) {
  const [selectedType, setSelectedType] = useState<ConsentType>(DEFAULT_CONSENT_TYPE);
  const content = useMemo(
    () => typeContents[selectedType] ?? typeContents[DEFAULT_CONSENT_TYPE] ?? "",
    [selectedType, typeContents]
  );

  return (
    <form action={addConsentAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Tipo
          <select
            name="consentType"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as ConsentType)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {CONSENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Canale
          <select
            name="consentChannel"
            defaultValue="Di persona"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Scadenza (opzionale)
          <input
            type="date"
            name="consentExpiresAt"
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm text-zinc-700">
          <span className="font-medium text-zinc-800">Revoca</span>
          <span className="text-xs text-zinc-500">
            La data/ora viene registrata automaticamente quando imposti lo stato su "Revocato".
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <PatientConsentSection content={content} />
      </div>
    </form>
  );
}
