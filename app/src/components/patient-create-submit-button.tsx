"use client";

import { useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

const CONSENT_REQUIRED_EVENT = "consent-required-status";

type Props = {
  className?: string;
  label: string;
  pendingLabel?: string;
};

export function PatientCreateSubmitButton({ className, label, pendingLabel }: Props) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const initialValue = (window as typeof window & { __consentRequiredComplete?: boolean })
      .__consentRequiredComplete;
    if (typeof initialValue === "boolean") {
      setIsComplete(initialValue);
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ complete?: boolean }>).detail;
      setIsComplete(Boolean(detail?.complete));
    };
    window.addEventListener(CONSENT_REQUIRED_EVENT, handler as EventListener);
    return () => window.removeEventListener(CONSENT_REQUIRED_EVENT, handler as EventListener);
  }, []);

  return (
    <FormSubmitButton
      className={className}
      disabled={!isComplete}
      pendingLabel={pendingLabel}
    >
      {label}
    </FormSubmitButton>
  );
}
