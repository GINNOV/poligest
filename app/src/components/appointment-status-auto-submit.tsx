"use client";

import { useRef, useState } from "react";

type StatusOption = {
  value: string;
  label: string;
};

type Props = {
  appointmentId: string;
  defaultValue: string;
  options: StatusOption[];
  action: (formData: FormData) => void;
  className?: string;
};

export function AppointmentStatusAutoSubmit({
  appointmentId,
  defaultValue,
  options,
  action,
  className,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = () => {
    setIsSaving(true);
    const form = formRef.current;
    if (!form) return;
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.submit();
  };

  return (
    <form ref={formRef} action={action} className={`flex flex-col ${className ?? ""}`}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <select
        name="status"
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={isSaving}
        className="h-9 w-full rounded-full border border-zinc-200 bg-white px-3 pr-2 text-[11px] font-semibold uppercase text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label.toUpperCase()}
          </option>
        ))}
      </select>
      {isSaving ? (
        <span className="mt-1 text-[11px] font-semibold text-emerald-700">Salvataggio...</span>
      ) : null}
    </form>
  );
}
