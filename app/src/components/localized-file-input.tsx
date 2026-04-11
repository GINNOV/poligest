"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  accept?: string;
  required?: boolean;
  buttonText?: string;
  placeholder?: string;
  helperText?: string;
  className?: string;
};

export function LocalizedFileInput({
  name,
  accept,
  required,
  buttonText = "Scegli file",
  placeholder = "Nessun file selezionato",
  helperText,
  className,
}: Props) {
  const inputId = useId();
  const [fileLabel, setFileLabel] = useState<string>(placeholder);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-inner transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
        >
          {buttonText}
          <input
            id={inputId}
            name={name}
            accept={accept}
            required={required}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFileLabel(file?.name || placeholder);
            }}
          />
        </label>
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{fileLabel}</span>
      </div>
      {helperText ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p> : null}
    </div>
  );
}
