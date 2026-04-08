"use client";

import { useMemo, useState } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
};

const SERVICE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; pill: string }
> = {
  "prima visita": {
    bg: "bg-sky-50 dark:bg-sky-950/35",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-900 dark:text-sky-100",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
  },
  "visita di controllo": {
    bg: "bg-emerald-50 dark:bg-emerald-950/35",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-100",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  },
  urgenza: {
    bg: "bg-rose-50 dark:bg-rose-950/35",
    border: "border-rose-200 dark:border-rose-800",
    text: "text-rose-900 dark:text-rose-100",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100",
  },
  richiamo: {
    bg: "bg-amber-50 dark:bg-amber-950/35",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-100",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  },
  igiene: {
    bg: "bg-cyan-50 dark:bg-cyan-950/35",
    border: "border-cyan-200 dark:border-cyan-800",
    text: "text-cyan-900 dark:text-cyan-100",
    pill: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-100",
  },
  otturazione: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    pill: "bg-indigo-100 text-indigo-800",
  },
  devitalizzazione: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-900",
    pill: "bg-violet-100 text-violet-800",
  },
  estrazione: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-800",
  },
  "estrazione chirurgica": {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    pill: "bg-red-100 text-red-800",
  },
  "ablazione tartaro": {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-900",
    pill: "bg-teal-100 text-teal-800",
  },
  implantologia: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-900",
    pill: "bg-orange-100 text-orange-800",
  },
  "protesi mobile": {
    bg: "bg-lime-50",
    border: "border-lime-200",
    text: "text-lime-900",
    pill: "bg-lime-100 text-lime-800",
  },
  "protesi fissa": {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    pill: "bg-yellow-100 text-yellow-800",
  },
  altro: {
    bg: "bg-zinc-50 dark:bg-zinc-900",
    border: "border-zinc-200 dark:border-zinc-700",
    text: "text-zinc-900 dark:text-zinc-100",
    pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  },
};

function getServiceStyle(serviceType: string) {
  const key = (serviceType ?? "").toLowerCase().trim();
  return (
    SERVICE_STYLES[key] ?? {
      bg: "bg-zinc-50 dark:bg-zinc-900",
      border: "border-zinc-200 dark:border-zinc-700",
      text: "text-zinc-900 dark:text-zinc-100",
      pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    }
  );
}

function getStartOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function AppointmentsCalendar({ events }: { events: CalendarEvent[] }) {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getStartOfWeek(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + idx);
      return d;
    });
  }, [currentMonday]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    weekDays.forEach((d) => {
      const key = d.toISOString().split("T")[0];
      map.set(key, []);
    });
    events.forEach((ev) => {
      const key = ev.startsAt.split("T")[0];
      if (map.has(key)) {
        map.get(key)?.push(ev);
      }
    });
    return map;
  }, [events, weekDays]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return "";
    const fmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  }, [weekDays]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settimana del...</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentMonday((prev) => {
                const next = new Date(prev);
                next.setDate(prev.getDate() - 7);
                return getStartOfWeek(next);
              })
            }
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
          >
            ← Settimana precedente
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentMonday((prev) => {
                const next = new Date(prev);
                next.setDate(prev.getDate() + 7);
                return getStartOfWeek(next);
              })
            }
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
          >
            Settimana successiva →
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1180px] grid-cols-[repeat(7,minmax(160px,1fr))] gap-3 text-xs text-zinc-600 dark:text-zinc-300">
          {weekDays.map((day) => {
            const key = day.toISOString().split("T")[0];
            const dayEvents = [...(eventsByDay.get(key) ?? [])].sort(
              (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            );
            const formatter = new Intl.DateTimeFormat("it-IT", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            return (
              <div key={key} className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
                  <span>{formatter.format(day)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-zinc-800 dark:text-emerald-300">
                    {dayEvents.length}
                  </span>
                </div>
                <div className="max-h-96 flex-1 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                  {dayEvents.length === 0 ? (
                    <p className="p-2 text-[11px] text-zinc-400 dark:text-zinc-500">Nessun appuntamento</p>
                  ) : (
                    dayEvents.map((ev) => {
                      const start = new Date(ev.startsAt);
                      const end = new Date(ev.endsAt);
                      const styles = getServiceStyle(ev.serviceType);
                      const timeLabel = `${start.toLocaleTimeString("it-IT", {
                        timeStyle: "short",
                      })} - ${end.toLocaleTimeString("it-IT", { timeStyle: "short" })}`;
                      return (
                        <div
                          key={ev.id}
                          className={`rounded-xl border p-3 text-[12px] shadow-sm ${styles.bg} ${styles.border} ${styles.text}`}
                        >
                          <div className="mb-2 flex flex-col items-center gap-1 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles.pill}`}
                            >
                              {ev.serviceType}
                            </span>
                            <span className="whitespace-nowrap text-[11px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
                              {timeLabel}
                            </span>
                          </div>
                          <div className="text-sm font-semibold leading-snug">{ev.title}</div>
                          <p className="text-[12px] text-zinc-700 dark:text-zinc-200">{ev.patientName}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
