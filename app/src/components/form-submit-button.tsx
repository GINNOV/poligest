"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
};

export function FormSubmitButton({ children, className, pendingLabel }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(className, pending && "opacity-70")}
      disabled={pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
