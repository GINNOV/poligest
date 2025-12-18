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
  const label = pending ? pendingLabel ?? children : children;

  return (
    <button
      type="submit"
      className={cn(
        "inline-flex items-center justify-center gap-2",
        className,
        pending && "cursor-not-allowed opacity-70"
      )}
      disabled={isDisabled}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-emerald-500"
        />
      ) : null}
      <span>{label}</span>
    </button>
  );
}
