"use client";

import { useEffect, useState } from "react";
import {
  formatEuropeanDate,
  formatEuropeanTime,
  parseEuropeanDate,
  parseEuropeanTime,
} from "@/lib/appointments/datetime-input";

type FieldProps = {
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
  required?: boolean;
};

function useDraft(value: string, format: (value: string) => string, parse: (value: string) => string | null, onChange: (value: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format(value);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  const handleChange = (next: string) => {
    setDraft(next);
    const parsed = parse(next);
    if (parsed && parsed !== value) onChange(parsed);
  };

  const handleBlur = () => {
    const parsed = draft === null ? null : parse(draft);
    if (parsed && parsed !== value) onChange(parsed);
    setDraft(null);
  };

  return { shown, handleChange, handleBlur };
}

export function EuropeanDateField({ value, onChange, name, className, required }: FieldProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const currentValue = value ?? internalValue;
  const commit = (next: string) => {
    setInternalValue(next);
    onChange?.(next);
  };
  const field = useDraft(currentValue, formatEuropeanDate, parseEuropeanDate, commit);

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        lang="it-IT"
        placeholder="gg/mm/aaaa"
        required={required}
        value={field.shown}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        className={className}
      />
    </>
  );
}

export function EuropeanTimeField({ value = "", onChange, className, required }: FieldProps) {
  const field = useDraft(value, formatEuropeanTime, parseEuropeanTime, onChange ?? (() => {}));

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      lang="it-IT"
      placeholder="hh:mm"
      required={required}
      value={field.shown}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      className={className}
    />
  );
}
