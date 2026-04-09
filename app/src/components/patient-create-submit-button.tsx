"use client";

import { useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

const CONSENT_REQUIRED_EVENT = "consent-required-status";
const PAPER_CONSENT_OVERRIDE_EVENT = "paper-consent-override-status";

type Props = {
  className?: string;
  label: string;
  pendingLabel?: string;
};

export function PatientCreateSubmitButton({ className, label, pendingLabel }: Props) {
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
    return () => window.removeEventListener(CONSENT_REQUIRED_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setHasPaperConsentOverride(Boolean(detail?.enabled));
    };
    window.addEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);
    return () => window.removeEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);
  }, []);

  return (
    <FormSubmitButton
      className={className}
      disabled={!isComplete && !hasPaperConsentOverride}
      pendingLabel={pendingLabel}
    >
      {label}
    </FormSubmitButton>
  );
}
