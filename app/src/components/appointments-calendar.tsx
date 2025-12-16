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
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-900",
    pill: "bg-sky-100 text-sky-800",
  },
  "visita di controllo": {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    pill: "bg-emerald-100 text-emerald-800",
  },
  urgenza: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-900",
    pill: "bg-rose-100 text-rose-800",
  },
  richiamo: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-800",
  },
  igiene: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-900",
    pill: "bg-cyan-100 text-cyan-800",
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
    bg: "bg-zinc-50",
    border: "border-zinc-200",
    text: "text-zinc-900",
    pill: "bg-zinc-100 text-zinc-700",
  },
};

function getServiceStyle(serviceType: string) {
  const key = (serviceType ?? "").toLowerCase().trim();
  return (
    SERVICE_STYLES[key] ?? {
      bg: "bg-zinc-50",
      border: "border-zinc-200",
      text: "text-zinc-900",
      pill: "bg-zinc-100 text-zinc-700",
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Settimana del...</h3>
          <p className="text-xs text-zinc-500">{weekLabel}</p>
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
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
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
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Settimana successiva →
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1180px] grid-cols-[repeat(7,minmax(160px,1fr))] gap-3 text-xs text-zinc-600">
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
              <div key={key} className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-800">
                  <span>{formatter.format(day)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {dayEvents.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 max-h-96">
                  {dayEvents.length === 0 ? (
                    <p className="p-2 text-[11px] text-zinc-400">Nessun appuntamento</p>
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
                            <span className="whitespace-nowrap text-[11px] font-semibold leading-tight text-zinc-600">
                              {timeLabel}
                            </span>
                          </div>
                          <div className="text-sm font-semibold leading-snug">{ev.title}</div>
                          <p className="text-[12px] text-zinc-700">{ev.patientName}</p>
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
