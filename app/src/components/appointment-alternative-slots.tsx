"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  browseDate: string;
  onBrowseDateChange: (date: string) => void;
  displayTimeZone?: string;
  onSelectSlot: (slot: { startsAt: string; endsAt: string }) => void;
  findFirstToken?: number;
  variant?: "inline" | "collapsible";
};

export function AppointmentAlternativeSlots({
  appointmentId,
  doctorId,
  startsAt,
  endsAt,
  browseDate,
  onBrowseDateChange,
  displayTimeZone = "Europe/Rome",
  onSelectSlot,
  findFirstToken = 0,
  variant = "inline",
}: Props) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [loading, setLoading] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(false);
  const [slots, setSlots] = useState<AlternativeSlot[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [appliedSlotMessage, setAppliedSlotMessage] = useState<string | null>(null);
  const skipAutoSearch = useRef(false);
  const lastFindFirstToken = useRef(findFirstToken);

  const durationMinutes = useMemo(
    () => computeAppointmentDurationMinutes(startsAt, endsAt, displayTimeZone),
    [startsAt, endsAt, displayTimeZone],
  );

  const quickDates = useMemo(() => {
    const base = browseDate || formatDateInputValueInTimeZone(new Date(), displayTimeZone);
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
        label: offset === 1 ? "Domani" : offset === 2 ? "+2g" : "+1sett",
        hint: formatter.format(next),
      };
    });
  }, [browseDate, displayTimeZone]);

  const fetchSlots = async (params: URLSearchParams) => {
    const response = await fetch(`/api/appointments/alternative-slots?${params.toString()}`);
    const payload = (await response.json()) as {
      slots?: AlternativeSlot[];
      blockedReason?: string;
    };

    if (!response.ok) {
      throw new Error(payload.blockedReason ?? "Impossibile cercare slot liberi.");
    }

    return payload;
  };

  const handleSearch = async (date = browseDate) => {
    if (!doctorId) {
      setBlockedReason("Seleziona un medico per cercare slot liberi.");
      setSlots([]);
      setHasSearched(true);
      return;
    }

    if (!date) return;

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
      const payload = await fetchSlots(params);

      setSlots(payload.slots ?? []);
      setBlockedReason(payload.blockedReason ?? null);
    } catch (error) {
      setSlots([]);
      setBlockedReason(error instanceof Error ? error.message : "Impossibile cercare slot liberi.");
    } finally {
      setLoading(false);
    }
  };

  const applySlot = (slot: AlternativeSlot, message: string) => {
    onSelectSlot({ startsAt: slot.startsAtLocal, endsAt: slot.endsAtLocal });
    setAppliedSlotMessage(message);
  };

  const slotDurationClass = (isSelected: boolean) => {
    if (isSelected) {
      if (durationMinutes <= 20) {
        return "border-sky-500 bg-sky-100 text-sky-900 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100";
      }
      if (durationMinutes <= 45) {
        return "border-emerald-500 bg-emerald-100 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100";
      }
      return "border-violet-500 bg-violet-100 text-violet-900 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100";
    }

    if (durationMinutes <= 20) {
      return "border-sky-200 bg-white text-sky-800 hover:border-sky-300 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-zinc-950 dark:text-sky-200 dark:hover:bg-sky-950/30";
    }
    if (durationMinutes <= 45) {
      return "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:bg-emerald-950/30";
    }
    return "border-violet-200 bg-white text-violet-800 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-900/50 dark:bg-zinc-950 dark:text-violet-200 dark:hover:bg-violet-950/30";
  };

  const handleFindFirst = async () => {
    if (!doctorId) {
      setBlockedReason("Seleziona un medico per cercare slot liberi.");
      setSlots([]);
      setHasSearched(true);
      return;
    }

    const fromDate = formatDateInputValueInTimeZone(new Date(), displayTimeZone);

    setLoadingFirst(true);
    setBlockedReason(null);
    setHasSearched(true);
    setAppliedSlotMessage(null);

    try {
      const params = new URLSearchParams({
        doctorId,
        mode: "first",
        date: fromDate,
        durationMinutes: String(durationMinutes),
        excludeId: appointmentId,
        timeZone: displayTimeZone,
      });
      const payload = await fetchSlots(params);
      const foundSlots = payload.slots ?? [];

      setSlots(foundSlots);
      setBlockedReason(payload.blockedReason ?? null);

      const firstSlot = foundSlots[0];
      if (firstSlot) {
        skipAutoSearch.current = true;
        applySlot(firstSlot, "Primo slot libero applicato ai campi sopra.");
      }
    } catch (error) {
      setSlots([]);
      setBlockedReason(error instanceof Error ? error.message : "Impossibile cercare slot liberi.");
    } finally {
      setLoadingFirst(false);
    }
  };

  useEffect(() => {
    if (findFirstToken === 0 || findFirstToken === lastFindFirstToken.current) return;
    lastFindFirstToken.current = findFirstToken;
    void handleFindFirst();
  }, [findFirstToken]);

  useEffect(() => {
    if (variant !== "inline" || !isOpen) return;
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (!doctorId || !browseDate) return;

    const timer = window.setTimeout(() => {
      void handleSearch(browseDate);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [variant, isOpen, doctorId, browseDate, durationMinutes, appointmentId, displayTimeZone]);

  const panelContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {quickDates.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            onClick={() => {
              skipAutoSearch.current = false;
              onBrowseDateChange(option.value);
            }}
            className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-800 transition hover:border-sky-300 dark:border-sky-800 dark:bg-zinc-950 dark:text-sky-200"
          >
            {option.label}
          </button>
        ))}
        {loading ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Ricerca...</span> : null}
        {loadingFirst ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Primo slot...</span> : null}
      </div>

      {hasSearched ? (
        blockedReason ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{blockedReason}</p>
        ) : slots.length === 0 && !loading && !loadingFirst ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nessuno slot libero trovato in questo giorno.
          </p>
        ) : (
          <div className="space-y-2">
            {appliedSlotMessage ? (
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{appliedSlotMessage}</p>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              {slots.map((slot) => {
                const isSelected =
                  slot.startsAtLocal === startsAt && slot.endsAtLocal === endsAt;
                return (
                  <button
                    key={`${slot.startsAtLocal}-${slot.endsAtLocal}`}
                    type="button"
                    onClick={() => applySlot(slot, "Slot applicato ai campi sopra.")}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition sm:shrink ${slotDurationClass(isSelected)}`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>
        )
      ) : null}
    </div>
  );

  if (variant === "collapsible") {
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
              Durata: {durationMinutes} min
            </p>
          </div>
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
            {isOpen ? "Nascondi" : "Apri"}
          </span>
        </button>
        {isOpen ? <div className="mt-4">{panelContent}</div> : null}
      </div>
    );
  }

  return (
    <div className="col-span-full rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
      <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Slot liberi</p>
      <div className="mt-3">{panelContent}</div>
    </div>
  );
}