"use client";

import { useEffect, useState } from "react";

const PAPER_CONSENT_OVERRIDE_EVENT = "paper-consent-override-status";

export function PatientPaperConsentCheckbox() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as typeof window & { __paperConsentOverride?: boolean }).__paperConsentOverride = checked;
    window.dispatchEvent(
      new CustomEvent(PAPER_CONSENT_OVERRIDE_EVENT, { detail: { enabled: checked } })
    );
  }, [checked]);

  return (
    <label className="flex items-start gap-3 text-sm text-zinc-800">
      <input
        type="checkbox"
        name="hasPaperConsentForRequired"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300"
      />
      <span>
        Firma esiste su scheda cartacea per moduli obbligatori.
      </span>
    </label>
  );
}
