"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => Promise<void>;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  cancelText?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "danger" | "warning" | "default";
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(className, isPending && "opacity-60 cursor-not-allowed")}
    >
      {children}
    </button>
  );
}
