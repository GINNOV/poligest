"use client";

import { appointmentMinuteOptions, parseEuropeanTime } from "@/lib/appointments/datetime-input";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
};

const selectClass =
  "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

const pad = (value: number) => value.toString().padStart(2, "0");

export function AppointmentTimeField({ value = "", onChange, required }: Props) {
  const parsed = parseEuropeanTime(value);
  const hour = parsed ? Number(parsed.slice(0, 2)) : null;
  const minute = parsed ? Number(parsed.slice(3, 5)) : null;

  const commit = (nextHour: number, nextMinute: number) => {
    onChange?.(`${pad(nextHour)}:${pad(nextMinute)}`);
  };

  return (
    <div className="flex flex-nowrap items-end gap-2">
      <label>
        <span className="sr-only">Ora</span>
        <select
          required={required}
          value={hour ?? ""}
          onChange={(event) => commit(Number(event.target.value), minute ?? 0)}
          className={`${selectClass} w-[5.25rem]`}
        >
          {hour === null ? <option value="">—</option> : null}
          {Array.from({ length: 24 }, (_, index) => (
            <option key={index} value={index}>
              {pad(index)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Minuti</span>
        <select
          required={required}
          value={minute ?? ""}
          onChange={(event) => commit(hour ?? 9, Number(event.target.value))}
          className={`${selectClass} w-[5.25rem]`}
        >
          {minute === null ? <option value="">—</option> : null}
          {appointmentMinuteOptions(minute).map((option) => (
            <option key={option} value={option}>
              {pad(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <span className="sr-only">Apri l&apos;orologio</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
        <input
          type="time"
          lang="it-IT"
          step={300}
          value={parsed ?? ""}
          onChange={(event) => {
            const next = parseEuropeanTime(event.target.value.slice(0, 5));
            if (next) onChange?.(next);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
