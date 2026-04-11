"use client";

import { useTransition } from "react";
import { Button } from "./ui/button";

type Props = {
  action: (formData: FormData) => Promise<void>;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  cancelText?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg";
  formId?: string;
  name?: string;
  value?: string;
};

/**
 * A reusable Client Component that handles server actions with a window.confirm dialog.
 * Use this in Server Components when you need to trigger an action with confirmation.
 */
export function ConfirmButton({
  action,
  confirmMessage = "Sei sicuro di voler procedere?",
  children,
  className,
  variant = "primary",
  size,
  name,
  value,
}: Props) {
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    if (window.confirm(confirmMessage)) {
      startTransition(async () => {
        try {
          const formData = new FormData();
          if (name && value) {
            formData.append(name, value);
          }
          await action(formData);
        } catch (error) {
          console.error("Action failed:", error);
          alert(error instanceof Error ? error.message : "Si è verificato un errore inaspettato.");
        }
      });
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      loading={isPending}
      className={className}
      variant={variant}
      size={size}
    >
      {children}
    </Button>
  );
}
