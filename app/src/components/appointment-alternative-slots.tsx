"use client";

import { useMemo, useState } from "react";
import { computeAppointmentDurationMinutes } from "@/lib/appointments/find-alternative-slots";
import { formatDateInputValueInTimeZone } from "@/lib/user-display-time-zone";

type AlternativeSlot = {
  startsAtLocal: string;
  endsAtLocal: string;
  label: string;
};

type Props = {
  appointmentId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  displayTimeZone?: string;
  onSelectSlot: (slot: { startsAt: string; endsAt: string }) => void;
};

export function AppointmentAlternativeSlots({
  appointmentId,
  doctorId,
  startsAt,
  endsAt,
  displayTimeZone = "Europe/Rome",
  onSelectSlot,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchDate, setSearchDate] = useState(() => startsAt.split("T")[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<AlternativeSlot[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const durationMinutes = useMemo(
    () => computeAppointmentDurationMinutes(startsAt, endsAt, displayTimeZone),
    [startsAt, endsAt, displayTimeZone],
  );

  const quickDates = useMemo(() => {
    const base = startsAt.split("T")[0] ?? formatDateInputValueInTimeZone(new Date(), displayTimeZone);
    const [year, month, day] = base.split("-").map(Number);
    const anchor = new Date(year, month - 1, day);
    const formatter = new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    return [1, 2, 7].map((offset) => {
      const next = new Date(anchor);
      next.setDate(next.getDate() + offset);
      const value = formatDateInputValueInTimeZone(next, displayTimeZone);
      return {
        value,
        label:
          offset === 1 ? "Domani" : offset === 2 ? "Tra 2 giorni" : "Tra 1 settimana",
        hint: formatter.format(next),
      };
    });
  }, [startsAt, displayTimeZone]);

  const handleSearch = async (date = searchDate) => {
    if (!doctorId) {
      setBlockedReason("Seleziona un medico per cercare slot liberi.");
      setSlots([]);
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setBlockedReason(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        doctorId,
        date,
        durationMinutes: String(durationMinutes),
        excludeId: appointmentId,
        timeZone: displayTimeZone,
      });
      const response = await fetch(`/api/appointments/alternative-slots?${params.toString()}`);
      const payload = (await response.json()) as {
        slots?: AlternativeSlot[];
        blockedReason?: string;
      };

      if (!response.ok) {
        throw new Error(payload.blockedReason ?? "Impossibile cercare slot liberi.");
      }

      setSlots(payload.slots ?? []);
      setBlockedReason(payload.blockedReason ?? null);
    } catch (error) {
      setSlots([]);
      setBlockedReason(error instanceof Error ? error.message : "Impossibile cercare slot liberi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col-span-full rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Trova slot alternativo</p>
          <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-200/80">
            Cerca spazi liberi con la stessa durata ({durationMinutes} min) quando il paziente chiede un altro giorno.
          </p>
        </div>
        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">{isOpen ? "Nascondi" : "Apri"}</span>
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold">Giorno da controllare</span>
              <input
                type="date"
                value={searchDate}
                onChange={(event) => setSearchDate(event.target.value)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              />
            </label>
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={loading || !searchDate}
              className="h-11 rounded-full bg-sky-700 px-5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Ricerca..." : "Cerca slot liberi"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickDates.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSearchDate(option.value);
                  void handleSearch(option.value);
                }}
                className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-sky-800 transition hover:border-sky-300 dark:border-sky-800 dark:bg-zinc-950 dark:text-sky-200"
              >
                <span>{option.label}</span>
                <span className="ml-2 font-normal text-sky-700/80 dark:text-sky-300/80">{option.hint}</span>
              </button>
            ))}
          </div>

          {hasSearched ? (
            blockedReason ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{blockedReason}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Nessuno slot libero trovato in questo giorno con durata {durationMinutes} minuti.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={`${slot.startsAtLocal}-${slot.endsAtLocal}`}
                    type="button"
                    onClick={() => onSelectSlot({ startsAt: slot.startsAtLocal, endsAt: slot.endsAtLocal })}
                    className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}