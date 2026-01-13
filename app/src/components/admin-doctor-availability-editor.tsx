"use client";

import { useMemo, useState } from "react";

type AvailabilityWindowRow = {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  color: string | null;
};

type Weekday = {
  value: number;
  label: string;
  short: string;
};

const WEEKDAYS: Weekday[] = [
  { value: 1, label: "Lunedì", short: "L" },
  { value: 2, label: "Martedì", short: "Ma" },
  { value: 3, label: "Mercoledì", short: "Me" },
  { value: 4, label: "Giovedì", short: "G" },
  { value: 5, label: "Venerdì", short: "V" },
  { value: 6, label: "Sabato", short: "S" },
  { value: 7, label: "Domenica", short: "D" },
];

// Fixed palette to avoid a confusing free-form color picker.
const BASE_COLOR_OPTIONS = [
  "#10b981", // emerald
  "#22c55e", // green
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#f97316", // orange
  "#f59e0b", // amber
  "#e11d48", // rose
  "#a855f7", // violet
  "#06b6d4", // cyan
  "#94a3b8", // slate
];

function minutesToTime(minutes: number) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const hours = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const mins = (safe % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function ColorSwatches({
  name,
  defaultValue,
  palette,
}: {
  name: string;
  defaultValue: string;
  palette: string[];
}) {
  const effectiveDefault = palette.includes(defaultValue) ? defaultValue : palette[0];

  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => (
        <label
          key={color}
          className="group relative inline-flex h-10 w-12 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white transition hover:border-emerald-200 hover:shadow-sm"
        >
          <input
            type="radio"
            name={name}
            value={color}
            defaultChecked={color === effectiveDefault}
            className="peer sr-only"
          />
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white shadow-inner"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-lg font-bold text-emerald-900 peer-checked:flex">
            ✓
          </span>
        </label>
      ))}
    </div>
  );
}

type Props = {
  doctorId: string;
  doctorColor: string | null;
  windows: AvailabilityWindowRow[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function AdminDoctorAvailabilityEditor({
  doctorId,
  doctorColor,
  windows,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const palette = useMemo(() => {
    const set = new Set(BASE_COLOR_OPTIONS);
    if (doctorColor) set.add(doctorColor);
    windows.forEach((w) => {
      if (w.color) set.add(w.color);
    });
    return Array.from(set).slice(0, 10);
  }, [doctorColor, windows]);

  const windowsByDay = useMemo(() => {
    const map = new Map<number, AvailabilityWindowRow[]>();
    for (const win of windows) {
      const list = map.get(win.dayOfWeek) ?? [];
      list.push(win);
      map.set(win.dayOfWeek, list);
    }
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => a.startMinute - b.startMinute);
      map.set(day, list);
    }
    return map;
  }, [windows]);

  const selectedDayMeta = WEEKDAYS.find((w) => w.value === selectedDay) ?? WEEKDAYS[0];
  const selectedWindows = windowsByDay.get(selectedDay) ?? [];
  const hasAvailability = (day: number) => (windowsByDay.get(day)?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Seleziona un giorno</h3>
          <p className="text-xs text-zinc-600">
            Le fasce sono modificabili in-place. I giorni senza fasce sono segnati come OFF.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {windows.length} fasce totali
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {WEEKDAYS.map((day) => {
          const active = day.value === selectedDay;
          const available = hasAvailability(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => setSelectedDay(day.value)}
              className={`group relative grid h-14 w-14 place-items-center rounded-full text-sm font-semibold transition ${
                active
                  ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-white"
                  : "hover:ring-2 hover:ring-zinc-200 hover:ring-offset-2 hover:ring-offset-white"
              } ${available ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700"}`}
              aria-pressed={active}
              aria-label={day.label}
              title={day.label}
            >
              {day.short}
              {available ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-200" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-zinc-900">{selectedDayMeta.label}</h4>
            <p className="text-xs text-zinc-600">
              {selectedWindows.length ? `${selectedWindows.length} fasce` : "OFF: nessuna disponibilità"}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {minutesToTime(9 * 60)} - {minutesToTime(13 * 60)}
          </span>
        </div>

        <form
          action={createAction}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr,1fr]"
        >
          <input type="hidden" name="doctorId" value={doctorId} />
          <input type="hidden" name="dayOfWeek" value={selectedDay} />
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Inizio
            <input
              name="startTime"
              type="time"
              required
              defaultValue="09:00"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Fine
            <input
              name="endTime"
              type="time"
              required
              defaultValue="13:00"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Colore
            <ColorSwatches
              name="color"
              palette={palette}
              defaultValue={doctorColor ?? palette[0]}
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Aggiungi
            </button>
          </div>
        </form>

        <div className="mt-5 space-y-3">
          {selectedWindows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              Nessuna fascia impostata per {selectedDayMeta.label}. Aggiungine una sopra.
            </div>
          ) : (
            selectedWindows.map((win, index) => (
              <div
                key={win.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <form
                    action={updateAction}
                    className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[auto,1fr,1fr,1fr]"
                  >
                    <div className="flex items-center">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
                        {index + 1}
                      </span>
                    </div>
                    <input type="hidden" name="windowId" value={win.id} />
                    <input type="hidden" name="doctorId" value={doctorId} />
                    <input type="hidden" name="dayOfWeek" value={selectedDay} />
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                      Inizio
                      <input
                        name="startTime"
                        type="time"
                        required
                        defaultValue={minutesToTime(win.startMinute)}
                        className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                      Fine
                      <input
                        name="endTime"
                        type="time"
                        required
                        defaultValue={minutesToTime(win.endMinute)}
                        className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                      Colore
                      <ColorSwatches
                        name="color"
                        palette={palette}
                        defaultValue={win.color ?? doctorColor ?? palette[0]}
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Aggiorna
                      </button>
                    </div>
                  </form>
                  <form
                    action={deleteAction}
                    className="flex justify-start sm:justify-end"
                    data-confirm="Eliminare definitivamente questa disponibilita?"
                  >
                    <input type="hidden" name="windowId" value={win.id} />
                    <input type="hidden" name="doctorId" value={doctorId} />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                    >
                      Elimina
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
