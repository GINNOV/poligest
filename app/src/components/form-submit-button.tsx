"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
};

export function FormSubmitButton({ children, className, pendingLabel, disabled }: Props) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      className={cn(className, pending && "opacity-70")}
      disabled={isDisabled}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
