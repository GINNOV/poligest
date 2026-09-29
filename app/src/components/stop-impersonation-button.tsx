"use client";

import { useTransition } from "react";
import { stopImpersonation } from "@/lib/impersonation-actions";
import { Button, type ButtonProps } from "@/components/ui/button";

type Props = {
  label: string;
  nextHref: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export function StopImpersonationButton({ label, nextHref, className, variant, size }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await stopImpersonation();
      window.location.assign(nextHref);
    });
  };

  if (variant) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={onClick}
      >
        {label}
      </Button>
    );
  }

  return (
    <button type="button" className={className} disabled={pending} onClick={onClick}>
      {label}
    </button>
  );
}
