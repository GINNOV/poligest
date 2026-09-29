"use client";

import {
  ITALIAN_MONTHS,
  appointmentDateParts,
  appointmentYearOptions,
  composeAppointmentDate,
  daysInMonth,
  describeVisitDay,
} from "@/lib/appointments/day-picker";
import { formatDateInputValueInTimeZone } from "@/lib/user-display-time-zone";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  timeZone?: string;
};

const selectClass =
  "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

export function AppointmentDayPicker({ value, onChange, timeZone = "Europe/Rome" }: Props) {
  const today = formatDateInputValueInTimeZone(new Date(), timeZone);
  const selected = value || today;
  const parts = appointmentDateParts(selected) ?? appointmentDateParts(today);
  if (!parts) return null;

  const commit = (year: number, month: number, day: number) => {
    const next = composeAppointmentDate(year, month, day);
    if (next) onChange(next);
  };

  return (
    <div className="col-span-full space-y-3">
      <div>
        <p className="text-sm font-bold text-rose-600 dark:text-rose-500">Giorno</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {describeVisitDay(selected, today)}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Giorno
          <select
            value={parts.day}
            onChange={(event) => commit(parts.year, parts.month, Number(event.target.value))}
            className={`${selectClass} w-[5.25rem]`}
          >
            {Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Mese
          <select
            value={parts.month}
            onChange={(event) => commit(parts.year, Number(event.target.value), parts.day)}
            className={`${selectClass} min-w-36`}
          >
            {ITALIAN_MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Anno
          <select
            value={parts.year}
            onChange={(event) => commit(Number(event.target.value), parts.month, parts.day)}
            className={`${selectClass} w-[6.5rem]`}
          >
            {appointmentYearOptions(today, selected).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          <span className="sr-only">Apri il calendario</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <input
            type="date"
            lang="it-IT"
            value={selected}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
