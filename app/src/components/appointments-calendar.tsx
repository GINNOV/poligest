"use client";

import { useMemo } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
};

const SERVICE_COLORS: Record<string, string> = {
  "prima visita": "bg-sky-100 text-sky-800 border-sky-200",
  "visita di controllo": "bg-emerald-100 text-emerald-800 border-emerald-200",
  urgenza: "bg-rose-100 text-rose-800 border-rose-200",
  richiamo: "bg-amber-100 text-amber-800 border-amber-200",
  igiene: "bg-cyan-100 text-cyan-800 border-cyan-200",
  otturazione: "bg-indigo-100 text-indigo-800 border-indigo-200",
  chirurgia: "bg-purple-100 text-purple-800 border-purple-200",
};

function getColorClasses(serviceType: string) {
  const key = serviceType.toLowerCase();
  return SERVICE_COLORS[key] ?? "bg-zinc-100 text-zinc-800 border-zinc-200";
}

export function AppointmentsCalendar({ events }: { events: CalendarEvent[] }) {
  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, []);

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

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Calendario (settimana corrente)</h3>
        <p className="text-xs text-zinc-500">Colori in base al tipo di appuntamento</p>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs text-zinc-600">
        {weekDays.map((day) => {
          const key = day.toISOString().split("T")[0];
          const dayEvents = eventsByDay.get(key) ?? [];
          const formatter = new Intl.DateTimeFormat("it-IT", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          return (
            <div key={key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-800">
                <span>{formatter.format(day)}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {dayEvents.length}
                </span>
              </div>
              <div className="relative h-80 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="absolute inset-y-0 left-0 w-px bg-zinc-100" />
                {dayEvents.length === 0 ? (
                  <p className="p-2 text-[11px] text-zinc-400">Nessun appuntamento</p>
                ) : (
                  dayEvents.map((ev) => {
                    const start = new Date(ev.startsAt);
                    const end = new Date(ev.endsAt);
                    const minutesStart = start.getHours() * 60 + start.getMinutes();
                    const minutesEnd = end.getHours() * 60 + end.getMinutes();
                    const duration = Math.max(minutesEnd - minutesStart, 30);
                    const top = (minutesStart / 1440) * 100;
                    const height = Math.min((duration / 1440) * 100, 100 - top);
                    const colorClass = getColorClasses(ev.serviceType);
                    return (
                      <div
                        key={ev.id}
                        className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-[11px] shadow-sm ${colorClass}`}
                        style={{ top: `${top}%`, height: `${height}%` }}
                      >
                        <div className="font-semibold leading-tight">{ev.title}</div>
                        <div className="text-[10px] leading-tight">
                          {ev.patientName}
                          <br />
                          {start.toLocaleTimeString("it-IT", { timeStyle: "short" })} -{" "}
                          {end.toLocaleTimeString("it-IT", { timeStyle: "short" })}
                        </div>
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
  );
}
