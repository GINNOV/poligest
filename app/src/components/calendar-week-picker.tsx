"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  label: string;
  weekKey: string;
};

export function CalendarWeekPicker({ label, weekKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const inputId = useMemo(() => `week-picker-${weekKey}`, [weekKey]);

  const handleChange = (value: string) => {
    if (!value) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", "week");
    nextParams.set("week", value);
    router.push(`/calendar?${nextParams.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-zinc-200 px-3 py-1 text-lg font-semibold text-zinc-900 transition hover:border-emerald-200 hover:text-emerald-700"
        aria-expanded={open}
        aria-controls={inputId}
      >
        {label}
      </button>
      {open ? (
        <div
          id={inputId}
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
        >
          <label className="text-[10px] font-semibold uppercase text-zinc-500">Seleziona settimana</label>
          <input
            type="date"
            value={weekKey}
            onChange={(event) => handleChange(event.target.value)}
            className="mt-2 h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      ) : null}
    </div>
  );
}
