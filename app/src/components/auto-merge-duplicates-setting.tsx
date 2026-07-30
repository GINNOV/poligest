"use client";

import { useTransition } from "react";
import { saveAutoMergeEmptyDuplicatesAction } from "@/app/_actions/practice-settings";
import { emitToast } from "@/components/global-toasts";

type Props = {
  enabled: boolean;
};

export function AutoMergeDuplicatesSetting({ enabled }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      action={(formData) => {
        startTransition(async () => {
          try {
            await saveAutoMergeEmptyDuplicatesAction(formData);
            emitToast(
              formData.get("enabled") === "on"
                ? "Auto-unione schede vuote attivata"
                : "Auto-unione schede vuote disattivata",
              "success",
            );
          } catch (error) {
            emitToast(error instanceof Error ? error.message : "Salvataggio non riuscito", "error");
          }
        });
      }}
    >
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">Auto-unione notturna</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Se attiva, ogni mattina il sistema unisce solo i gruppi sicuri con segnale forte (stesso
        codice fiscale, oppure nome+data di nascita con telefono/email). Solo schede vuote vengono
        eliminate.
      </p>
      <label className="mt-1 flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          disabled={isPending}
          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          onChange={(event) => {
            const form = event.currentTarget.form;
            if (!form) return;
            const formData = new FormData(form);
            if (event.currentTarget.checked) {
              formData.set("enabled", "on");
            } else {
              formData.delete("enabled");
            }
            startTransition(async () => {
              try {
                await saveAutoMergeEmptyDuplicatesAction(formData);
                emitToast(
                  event.currentTarget.checked
                    ? "Auto-unione schede vuote attivata"
                    : "Auto-unione schede vuote disattivata",
                  "success",
                );
              } catch (error) {
                emitToast(error instanceof Error ? error.message : "Salvataggio non riuscito", "error");
              }
            });
          }}
        />
        <span>{isPending ? "Salvataggio…" : "Unisci automaticamente i duplicati sicuri e forti"}</span>
      </label>
    </form>
  );
}
