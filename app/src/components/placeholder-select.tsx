"use client";

import { useEffect, useRef } from "react";
import { insertPlaceholderToken, type PlaceholderDefinition } from "@/lib/placeholder-data";

type TextField = HTMLInputElement | HTMLTextAreaElement;

function isTemplateField(target: EventTarget | null): target is TextField {
  return (
    (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) &&
    target.hasAttribute("data-placeholder-target")
  );
}

function fallbackField(form: HTMLFormElement) {
  return form.querySelector<TextField>("[data-placeholder-target]");
}

type Props = {
  placeholders: PlaceholderDefinition[];
};

export function PlaceholderSelect({ placeholders }: Props) {
  const rootRef = useRef<HTMLLabelElement>(null);
  const lastField = useRef<TextField | null>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onFocusIn = (event: FocusEvent) => {
      if (isTemplateField(event.target)) {
        lastField.current = event.target;
      }
    };
    form.addEventListener("focusin", onFocusIn);
    return () => form.removeEventListener("focusin", onFocusIn);
  }, []);

  const insert = (key: string) => {
    const form = rootRef.current?.closest("form");
    if (!form || !key) return;
    const remembered = lastField.current;
    const field = remembered && form.contains(remembered) ? remembered : fallbackField(form);
    if (!field) return;

    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const next = insertPlaceholderToken(field.value, start, end, key);
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(field, next.value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    requestAnimationFrame(() => {
      field.setSelectionRange(next.cursor, next.cursor);
    });
  };

  return (
    <label ref={rootRef} className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Segnaposto</span>
      <select
        aria-label="Inserisci segnaposto"
        defaultValue=""
        onChange={(event) => {
          const key = event.target.value;
          event.target.value = "";
          insert(key);
        }}
        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
      >
        <option value="">Inserisci un segnaposto…</option>
        {placeholders.map((item) => (
          <option key={item.key} value={item.key} title={item.description}>
            {item.label} ({`{{${item.key}}}`})
          </option>
        ))}
      </select>
    </label>
  );
}
