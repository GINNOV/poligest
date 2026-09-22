"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const FALLBACK_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#f97316",
  "#f59e0b",
  "#e11d48",
  "#a855f7",
  "#06b6d4",
  "#94a3b8",
  "#22c55e",
];

type DoctorOption = {
  id: string;
  label: string;
  color?: string | null;
};

type Props = {
  doctors: DoctorOption[];
  selectedDoctorId?: string;
  showAll?: boolean;
};

export function doctorSwatchColor(color: string | null | undefined, index: number) {
  const value = color?.trim() ?? "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/15"
      style={{ backgroundColor: color }}
    />
  );
}

export function CalendarDoctorFilter({ doctors, selectedDoctorId, showAll }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedValue = showAll ? "all" : selectedDoctorId ?? "all";
  const options = doctors.map((doctor, index) => ({
    ...doctor,
    swatch: doctorSwatchColor(doctor.color, index),
  }));
  const selected = options.find((doctor) => doctor.id === selectedValue);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (!value) {
      nextParams.delete("doctor");
    } else {
      nextParams.set("doctor", value);
    }
    const qs = nextParams.toString();
    router.push(qs ? `/calendar?${qs}` : "/calendar");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex w-full items-center gap-2 sm:w-auto">
      <label id={`${listId}-label`} className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        Medico
      </label>
      {doctors.length === 0 ? (
        <p className="h-10 rounded-full border border-zinc-200 px-4 text-sm leading-10 text-zinc-500 dark:border-zinc-700">
          Nessun medico disponibile
        </p>
      ) : (
        <>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-labelledby={`${listId}-label`}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900 sm:w-64"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              {selected ? (
                <Swatch color={selected.swatch} />
              ) : (
                <span className="inline-flex items-center -space-x-1" aria-hidden>
                  {options.slice(0, 4).map((doctor) => (
                    <span
                      key={doctor.id}
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white dark:ring-zinc-900"
                      style={{ backgroundColor: doctor.swatch }}
                    />
                  ))}
                </span>
              )}
              <span className="truncate">{selected?.label ?? "Tutto lo staff"}</span>
            </span>
            <span aria-hidden className="text-xs text-zinc-400">
              ▾
            </span>
          </button>
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={`${listId}-label`}
            hidden={!open}
            className="absolute right-0 top-11 z-50 max-h-72 w-full min-w-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selectedValue === "all"}
                onClick={() => handleChange("all")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-emerald-50 dark:text-zinc-100 dark:hover:bg-emerald-950/40"
              >
                <span className="inline-flex items-center -space-x-1" aria-hidden>
                  {options.slice(0, 4).map((doctor) => (
                    <span
                      key={doctor.id}
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white dark:ring-zinc-900"
                      style={{ backgroundColor: doctor.swatch }}
                    />
                  ))}
                </span>
                Tutto lo staff
              </button>
            </li>
            {options.map((doctor) => (
              <li key={doctor.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={doctor.id === selectedValue}
                  onClick={() => handleChange(doctor.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-emerald-50 dark:text-zinc-100 dark:hover:bg-emerald-950/40"
                >
                  <Swatch color={doctor.swatch} />
                  <span className="truncate">{doctor.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
