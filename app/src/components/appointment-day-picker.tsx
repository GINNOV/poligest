"use client";

import { useEffect, useState } from "react";
import {
  addCalendarDays,
  dayWindowStart,
  describeVisitDay,
  parseLooseAppointmentDate,
  visitDayChoices,
} from "@/lib/appointments/day-picker";
import { formatDateInputValueInTimeZone } from "@/lib/user-display-time-zone";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  timeZone?: string;
};

export function AppointmentDayPicker({ value, onChange, timeZone = "Europe/Rome" }: Props) {
  const today = formatDateInputValueInTimeZone(new Date(), timeZone);
  const [windowStart, setWindowStart] = useState(() => dayWindowStart(value || today, today));
  const [typed, setTyped] = useState("");
  const selected = value || today;
  const days = visitDayChoices(windowStart, today);
  const earliest = addCalendarDays(today, -14);
  const latest = addCalendarDays(today, 84);

  useEffect(() => {
    if (!value) return;
    setWindowStart((current) => {
      const end = addCalendarDays(current, 6);
      if (value >= current && value <= end) return current;
      return dayWindowStart(value, today);
    });
  }, [value, today]);

  const choose = (isoDate: string) => {
    setTyped("");
    onChange(isoDate);
  };

  return (
    <div className="col-span-full space-y-3">
      <div>
        <p className="text-sm font-bold text-rose-600 dark:text-rose-500">Giorno</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {describeVisitDay(selected, today)}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const isSelected = day.iso === selected;
          return (
            <button
              key={day.iso}
              type="button"
              aria-pressed={isSelected}
              onClick={() => choose(day.iso)}
              className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition ${
                isSelected
                  ? "border-emerald-700 bg-emerald-600 text-white"
                  : "border-zinc-300 bg-white text-zinc-900 hover:border-emerald-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              }`}
            >
              <span className={`text-xs font-semibold ${isSelected ? "text-emerald-50" : "text-zinc-500 dark:text-zinc-400"}`}>
                {day.name}
              </span>
              <span className="text-xl font-bold leading-6">{day.dayNumber}</span>
              <span className={`text-xs ${isSelected ? "text-emerald-50" : "text-zinc-500 dark:text-zinc-400"}`}>
                {day.month}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={windowStart <= earliest}
          onClick={() => setWindowStart((current) => addCalendarDays(current, -7))}
          className="h-10 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          Settimana prima
        </button>
        <button
          type="button"
          disabled={windowStart >= latest}
          onClick={() => setWindowStart((current) => addCalendarDays(current, 7))}
          className="h-10 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          Settimana dopo
        </button>
        <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <span className="shrink-0">Altra data</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            lang="it-IT"
            placeholder="15/10"
            value={typed}
            onChange={(event) => {
              const next = event.target.value;
              setTyped(next);
              const parsed = parseLooseAppointmentDate(next, today);
              if (parsed) onChange(parsed);
            }}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>
    </div>
  );
}
