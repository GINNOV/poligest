"use client";

import { FormSubmitButton } from "@/components/form-submit-button";
import { PlaceholderSelect } from "@/components/placeholder-select";
import { messagePlaceholders } from "@/lib/placeholder-data";

const inputClassName =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-50 dark:focus:ring-emerald-500/20";

const textareaClassName =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-50 dark:focus:ring-emerald-500/20";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function SmsTemplateForm({ action }: Props) {
  return (
    <form action={action} className="mt-4 space-y-3 text-sm">
      <label className="flex flex-col gap-2 font-medium text-zinc-800 dark:text-zinc-200">
        Nome
        <input
          name="name"
          className={inputClassName}
          placeholder="Es. Promemoria appuntamento"
          required
        />
      </label>
      <PlaceholderSelect placeholders={messagePlaceholders} />
      <label className="flex flex-col gap-2 font-medium text-zinc-800 dark:text-zinc-200">
        Testo SMS
        <textarea
          data-placeholder-target=""
          name="body"
          rows={5}
          className={textareaClassName}
          placeholder="Gentile {{nome}}, ti ricordiamo l'appuntamento di ..."
          required
        />
      </label>
      <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
        Crea template
      </FormSubmitButton>
    </form>
  );
}