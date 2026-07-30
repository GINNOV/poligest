"use client";

import { useState, useTransition } from "react";
import { saveAutoMergeEmptyDuplicatesAction } from "@/app/_actions/practice-settings";
import { emitToast } from "@/components/global-toasts";

type Props = {
  enabled: boolean;
};

export function AutoMergeDuplicatesSetting({ enabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setEnabled(next);
    const formData = new FormData();
    if (next) {
      formData.set("enabled", "true");
    } else {
      formData.set("enabled", "false");
    }
    startTransition(async () => {
      try {
        await saveAutoMergeEmptyDuplicatesAction(formData);
        emitToast(
          next
            ? "Unione automatica schede vuote attivata"
            : "Unione automatica schede vuote disattivata",
          "success",
        );
      } catch (error) {
        console.error("[auto-merge-duplicates-setting] failed", error);
        setEnabled(!next);
        emitToast("Impossibile aggiornare l'impostazione", "error");
      }
    });
  };

  return (
    <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      <input
        type="checkbox"
        checked={enabled}
        onChange={handleChange}
        disabled={isPending}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="min-w-0">
        <span className="block font-semibold text-zinc-900 dark:text-zinc-50">
          Unisci automaticamente schede vuote con match forte
        </span>
        <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
          Se attivo, il job programmato unisce solo le schede vuote con corrispondenza forte (codice
          fiscale o nome+data di nascita con telefono/email). Disattivo di default.
        </span>
      </span>
    </label>
  );
}
