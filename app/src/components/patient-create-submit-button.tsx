"use client";

import { useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

const CONSENT_REQUIRED_EVENT = "consent-required-status";
const PAPER_CONSENT_OVERRIDE_EVENT = "paper-consent-override-status";

type Props = {
  className?: string;
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
};

export function PatientCreateSubmitButton({ className, label, pendingLabel, disabled }: Props) {
  const [isComplete, setIsComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    const initialValue = (window as typeof window & { __consentRequiredComplete?: boolean })
      .__consentRequiredComplete;
    return typeof initialValue === "boolean" ? initialValue : false;
  });
  const [hasPaperConsentOverride, setHasPaperConsentOverride] = useState(() => {
    if (typeof window === "undefined") return false;
    const initialValue = (window as typeof window & { __paperConsentOverride?: boolean })
      .__paperConsentOverride;
    return typeof initialValue === "boolean" ? initialValue : false;
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ complete?: boolean }>).detail;
      setIsComplete(Boolean(detail?.complete));
    };
    window.addEventListener(CONSENT_REQUIRED_EVENT, handler as EventListener);

    // Re-check initial value after adding listener to catch events missed during mount
    const initialValue = (window as typeof window & { __consentRequiredComplete?: boolean })
      .__consentRequiredComplete;
    if (typeof initialValue === "boolean") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsComplete(prev => prev === initialValue ? prev : initialValue);
    }

    return () => window.removeEventListener(CONSENT_REQUIRED_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setHasPaperConsentOverride(Boolean(detail?.enabled));
    };
    window.addEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);

    // Re-check initial value after adding listener to catch events missed during mount
    const initialValue = (window as typeof window & { __paperConsentOverride?: boolean })
      .__paperConsentOverride;
    if (typeof initialValue === "boolean") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasPaperConsentOverride(prev => prev === initialValue ? prev : initialValue);
    }

    return () => window.removeEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);
  }, []);

  return (
    <FormSubmitButton
      className={className}
      disabled={disabled || (!isComplete && !hasPaperConsentOverride)}
      pendingLabel={pendingLabel}
    >
      {label}
    </FormSubmitButton>
  );
}
