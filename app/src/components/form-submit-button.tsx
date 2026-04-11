"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg";
};

export function FormSubmitButton({ children, className, pendingLabel, disabled, variant = "primary", size = "default" }: Props) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className={className}
      disabled={disabled}
      variant={variant}
      size={size}
      loading={pending}
      loadingLabel={pendingLabel}
      aria-busy={pending || undefined}
    >
      {children}
    </Button>
  );
}
