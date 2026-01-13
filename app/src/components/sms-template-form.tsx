"use client";

import { useRef } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

type Placeholder = {
  key: string;
  label: string;
  description: string;
};

const PLACEHOLDERS: Placeholder[] = [
  { key: "{{nome}}", label: "Nome", description: "Nome del paziente." },
  { key: "{{cognome}}", label: "Cognome", description: "Cognome del paziente." },
  { key: "{{dottore}}", label: "Dottore", description: "Medico assegnato all'appuntamento." },
  { key: "{{data_appuntamento}}", label: "Data appuntamento", description: "Data e ora del prossimo appuntamento." },
  { key: "{{motivo_visita}}", label: "Motivo visita", description: "Tipo di trattamento/visita." },
  { key: "{{note}}", label: "Note", description: "Note dell'appuntamento, se presenti." },
];

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function SmsTemplateForm({ action }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertPlaceholder = (value: string) => {
    const target = textareaRef.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const before = target.value.slice(0, start);
    const after = target.value.slice(end);
    const nextValue = `${before}${value}${after}`;
    target.value = nextValue;
    const cursor = start + value.length;
    target.setSelectionRange(cursor, cursor);
    target.focus();
  };

  return (
    <form action={action} className="mt-3 space-y-3 text-sm">
      <label className="flex flex-col gap-1">
        Nome
        <input
          name="name"
          className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Es. Promemoria appuntamento"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        Testo SMS
        <textarea
          ref={textareaRef}
          name="body"
          className="h-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Gentile {{nome}}, ti ricordiamo l'appuntamento di ..."
          required
        />
      </label>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Segnaposto disponibili
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLACEHOLDERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => insertPlaceholder(item.key)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {item.key}
            </button>
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-xs text-emerald-800">
          {PLACEHOLDERS.map((item) => (
            <li key={`${item.key}-desc`}>
              <span className="font-semibold">{item.key}</span>: {item.description}
            </li>
          ))}
        </ul>
      </div>
      <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
        Crea template
      </FormSubmitButton>
    </form>
  );
}
