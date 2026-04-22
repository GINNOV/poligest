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
  loading?: boolean;
};

export function FormSubmitButton({ children, className, pendingLabel, disabled, variant = "primary", size = "default", loading }: Props) {
  const { pending } = useFormStatus();
  const isLoading = loading ?? pending;

  return (
    <Button
      type="submit"
      className={className}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      loading={isLoading}
      loadingLabel={pendingLabel}
      aria-busy={isLoading || undefined}
    >
      {children}
    </Button>
  );
}
