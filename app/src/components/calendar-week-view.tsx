"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentCreateForm } from "@/components/appointment-create-form";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";

type CalendarAppointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  serviceType: string;
  patientName: string;
  patientId: string;
  doctorId: string | null;
  status: string;
};

type AvailabilityWindow = {
  startMinute: number;
  endMinute: number;
  color: string;
  doctorId?: string;
};

type WeekDay = {
  date: string;
  isToday: boolean;
  isPracticeClosed?: boolean;
  availabilityWindows: AvailabilityWindow[];
  appointments: CalendarAppointment[];
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

const HOUR_HEIGHT = 48;
const DEFAULT_DURATION_MINUTES = 60;

const padTime = (value: number) => value.toString().padStart(2, "0");

const toLocalInput = (date: string, minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${date}T${padTime(hours)}:${padTime(mins)}`;
};

type PositionedAppointment = CalendarAppointment & {
  startMinute: number;
  endMinute: number;
  columnIndex: number;
  columnCount: number;
};

const overlaps = (a: { startMinute: number; endMinute: number }, b: { startMinute: number; endMinute: number }) =>
  a.startMinute < b.endMinute && b.startMinute < a.endMinute;

const buildPositionedAppointments = (appointments: CalendarAppointment[]) => {
  const items = appointments.map((appt, index) => {
    const start = new Date(appt.startsAt);
    const end = new Date(appt.endsAt);
    const startMinute = start.getHours() * 60 + start.getMinutes();
    const endMinute = end.getHours() * 60 + end.getMinutes();
    return { appt, index, startMinute, endMinute };
  });

  const layout = new Map<number, { columnIndex: number; columnCount: number }>();
  const visited = new Set<number>();

  for (let i = 0; i < items.length; i += 1) {
    const seed = items[i];
    if (visited.has(seed.index)) continue;
    const stack = [seed];
    const component: typeof items = [];
    visited.add(seed.index);

    while (stack.length) {
      const current = stack.pop();
      if (!current) break;
      component.push(current);
      for (const candidate of items) {
        if (visited.has(candidate.index)) continue;
        if (overlaps(current, candidate)) {
          visited.add(candidate.index);
          stack.push(candidate);
        }
      }
    }

    component.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    const columnEnds: number[] = [];
    const assigned = new Map<number, number>();

    component.forEach((item) => {
      let columnIndex = columnEnds.findIndex((end) => end <= item.startMinute);
      if (columnIndex === -1) {
        columnIndex = columnEnds.length;
        columnEnds.push(item.endMinute);
      } else {
        columnEnds[columnIndex] = item.endMinute;
      }
      assigned.set(item.index, columnIndex);
    });

    const columnCount = Math.max(1, columnEnds.length);
    assigned.forEach((columnIndex, index) => {
      layout.set(index, { columnIndex, columnCount });
    });
  }

  return items.map((item) => {
    const placement = layout.get(item.index) ?? { columnIndex: 0, columnCount: 1 };
    return {
      ...item.appt,
      startMinute: item.startMinute,
      endMinute: item.endMinute,
      columnIndex: placement.columnIndex,
      columnCount: placement.columnCount,
    } satisfies PositionedAppointment;
  });
};

type Props = {
  weekDays: WeekDay[];
  patients: { id: string; firstName: string; lastName: string; email?: string | null }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  services: { id: string; name: string }[];
  availabilityWindows: { doctorId: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
  practiceClosures: { startsAt: string; endsAt: string; title?: string | null; type?: string }[];
  practiceWeeklyClosures: { dayOfWeek: number; title?: string | null }[];
  action: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  selectedDoctorId?: string;
  returnTo: string;
};

export function CalendarWeekView({
  weekDays,
  patients,
  doctors,
  serviceOptions,
  services,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  action,
  updateAction,
  deleteAction,
  selectedDoctorId,
  returnTo,
}: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ startsAt: string; endsAt: string } | null>(
    null
  );
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);

  const { timeStartMinute, timeEndMinute } = useMemo(() => {
    let minMinute = 8 * 60;
    let maxMinute = 18 * 60;
    weekDays.forEach((day) => {
      day.availabilityWindows.forEach((win) => {
        minMinute = Math.min(minMinute, win.startMinute);
        maxMinute = Math.max(maxMinute, win.endMinute);
      });
      day.appointments.forEach((appt) => {
        const start = new Date(appt.startsAt);
        const end = new Date(appt.endsAt);
        minMinute = Math.min(minMinute, start.getHours() * 60 + start.getMinutes());
        maxMinute = Math.max(maxMinute, end.getHours() * 60 + end.getMinutes());
      });
    });
    const roundedStart = Math.max(0, Math.floor(minMinute / 60) * 60 - 60);
    const roundedEnd = Math.min(24 * 60, Math.ceil(maxMinute / 60) * 60 + 60);
    return {
      timeStartMinute: roundedStart,
      timeEndMinute: Math.max(roundedEnd, roundedStart + 60),
    };
  }, [weekDays]);

  const totalMinutes = timeEndMinute - timeStartMinute;
  const gridHeight = (totalMinutes / 60) * HOUR_HEIGHT;

  const hourMarks = useMemo(() => {
    const startHour = Math.floor(timeStartMinute / 60);
    const endHour = Math.ceil(timeEndMinute / 60);
    return Array.from({ length: endHour - startHour + 1 }).map((_, idx) => startHour + idx);
  }, [timeStartMinute, timeEndMinute]);

  const selectedLabelDate = selectedSlot?.startsAt ?? selectedAppointment?.startsAt ?? null;

  useEffect(() => {
    if (!selectedSlot && !selectedAppointment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedSlot(null);
        setSelectedAppointment(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedSlot, selectedAppointment]);

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[70px_repeat(7,minmax(140px,1fr))] gap-2 text-[11px] font-semibold uppercase text-zinc-500">
            <div />
            {weekDays.map((day) => {
              const date = new Date(day.date);
              const label = new Intl.DateTimeFormat("it-IT", {
                weekday: "short",
                day: "numeric",
              }).format(date);
              return (
                <div key={day.date} className="flex items-center justify-between px-2">
                  <span
                    className={`rounded-full px-2 py-1 ${
                      day.isToday ? "bg-emerald-100 text-emerald-800" : ""
                    }`}
                  >
                    {label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-zinc-600 shadow-sm">
                    {day.appointments.length}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-[70px_repeat(7,minmax(140px,1fr))] gap-2">
            <div className="relative text-[10px] text-zinc-500" style={{ height: gridHeight }}>
              {hourMarks.map((hour) => {
                const minutes = hour * 60;
                if (minutes < timeStartMinute || minutes > timeEndMinute) return null;
                const top = ((minutes - timeStartMinute) / 60) * HOUR_HEIGHT;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 -translate-y-1/2 text-[10px] font-semibold"
                    style={{ top }}
                  >
                    {padTime(hour)}:00
                  </div>
                );
              })}
            </div>

            {weekDays.map((day) => {
              const positionedAppointments = buildPositionedAppointments(day.appointments);
              return (
                <div
                  key={day.date}
                  className="relative rounded-xl border border-zinc-200 bg-white p-1"
                  style={{ height: gridHeight }}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (day.isPracticeClosed) return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const offsetY = Math.max(0, event.clientY - bounds.top);
                    const minutesFromStart = Math.min(totalMinutes, (offsetY / bounds.height) * totalMinutes);
                    const rounded = Math.round(minutesFromStart / 15) * 15;
                    const startsAtMinute = Math.min(timeEndMinute - 15, timeStartMinute + rounded);
                    const endsAtMinute = Math.min(timeEndMinute, startsAtMinute + DEFAULT_DURATION_MINUTES);
                    setSelectedAppointment(null);
                    setSelectedSlot({
                      startsAt: toLocalInput(day.date, startsAtMinute),
                      endsAt: toLocalInput(day.date, endsAtMinute),
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (day.isPracticeClosed) return;
                    setSelectedAppointment(null);
                    setSelectedSlot({
                      startsAt: toLocalInput(day.date, timeStartMinute),
                      endsAt: toLocalInput(day.date, Math.min(timeEndMinute, timeStartMinute + DEFAULT_DURATION_MINUTES)),
                    });
                  }}
                >
                  <div className="absolute inset-0 rounded-xl bg-zinc-50" />
                  <div className="absolute inset-0">
                    {hourMarks.map((hour) => {
                      const minutes = hour * 60;
                      if (minutes < timeStartMinute || minutes > timeEndMinute) return null;
                      const top = ((minutes - timeStartMinute) / 60) * HOUR_HEIGHT;
                      return (
                        <div
                          key={`${day.date}-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-zinc-200/70"
                          style={{ top }}
                        />
                      );
                    })}
                  </div>

                  <div className="absolute inset-0">
                    {day.availabilityWindows.map((win, idx) => {
                      const startMinute = Math.max(win.startMinute, timeStartMinute);
                      const endMinute = Math.min(win.endMinute, timeEndMinute);
                      if (endMinute <= timeStartMinute || startMinute >= timeEndMinute) return null;
                      const top = ((startMinute - timeStartMinute) / 60) * HOUR_HEIGHT;
                      const height = ((endMinute - startMinute) / 60) * HOUR_HEIGHT;
                      const tint = `${win.color ?? "#10b981"}22`;
                      const border = `${win.color ?? "#10b981"}55`;
                      return (
                        <div
                          key={`${day.date}-avail-${idx}`}
                          className="absolute left-1 right-1 rounded-lg border"
                          style={{ top, height, backgroundColor: tint, borderColor: border }}
                        />
                      );
                    })}
                  </div>

                  <div className="absolute inset-0">
                    {positionedAppointments.map((appt) => {
                      const start = new Date(appt.startsAt);
                      const end = new Date(appt.endsAt);
                      const startMinute = appt.startMinute;
                      const endMinute = appt.endMinute;
                      if (endMinute <= timeStartMinute || startMinute >= timeEndMinute) return null;
                      const clampedStart = Math.max(startMinute, timeStartMinute);
                      const clampedEnd = Math.min(endMinute, timeEndMinute);
                      const top = ((clampedStart - timeStartMinute) / 60) * HOUR_HEIGHT;
                      const slotHeight = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
                      const height = Math.max(15, slotHeight - 2);
                      const styles = getServiceStyle(appt.serviceType);
                      const isCompact = height < 34;
                      const columnGap = 6;
                      const clickGutter = 8;
                      const columnWidth = 100 / appt.columnCount;
                      const left = `calc(${columnWidth * appt.columnIndex}% + ${columnGap / 2}px)`;
                      const width = `calc(${columnWidth}% - ${columnGap}px - ${clickGutter}px)`;
                      return (
                        <button
                          type="button"
                          key={appt.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedSlot(null);
                            setSelectedAppointment(appt);
                          }}
                          className={`absolute z-10 overflow-hidden rounded-lg border text-left text-[9px] shadow-sm transition hover:border-emerald-200 ${styles.bg} ${styles.border} ${styles.text} ${
                            isCompact ? "px-1.5 py-0.5" : "px-2 py-1"
                          }`}
                          style={{ top, height, left, width }}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span
                              className={`min-w-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styles.pill}`}
                            >
                              {appt.serviceType}
                            </span>
                            <span className="shrink-0 text-[9px] font-semibold text-zinc-600">
                              {start.toLocaleTimeString("it-IT", { timeStyle: "short" })}
                            </span>
                          </div>
                          {!isCompact ? (
                            <div className="mt-1 truncate text-[10px] font-semibold">
                              {appt.patientName}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {day.isPracticeClosed ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-rose-50/80 text-[11px] font-semibold text-rose-700">
                      CHIUSO
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSlot || selectedAppointment ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSlot(null);
              setSelectedAppointment(null);
            }
          }}
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {selectedAppointment ? "Aggiorna appuntamento" : "Nuovo appuntamento"}
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedLabelDate
                    ? new Intl.DateTimeFormat("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(
                        selectedLabelDate.length > 10
                          ? new Date(selectedLabelDate)
                          : new Date(
                              Number(selectedLabelDate.slice(0, 4)),
                              Number(selectedLabelDate.slice(5, 7)) - 1,
                              Number(selectedLabelDate.slice(8, 10))
                            )
                      )
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  setSelectedAppointment(null);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Chiudi
              </button>
            </div>

            {selectedAppointment ? (
              <div className="space-y-3">
                <AppointmentUpdateForm
                  appointment={{
                    id: selectedAppointment.id,
                    title: selectedAppointment.title,
                    serviceType: selectedAppointment.serviceType,
                    startsAt: selectedAppointment.startsAt,
                    endsAt: selectedAppointment.endsAt,
                    patientId: selectedAppointment.patientId,
                    doctorId: selectedAppointment.doctorId,
                    status: selectedAppointment.status,
                  }}
                  patients={patients}
                  doctors={doctors}
                  services={services}
                  availabilityWindows={availabilityWindows}
                  practiceClosures={practiceClosures}
                  practiceWeeklyClosures={practiceWeeklyClosures}
                  action={updateAction}
                  returnTo={returnTo}
                />
                <form
                  action={deleteAction}
                  className="flex justify-end"
                  data-confirm="Eliminare definitivamente questo appuntamento?"
                >
                  <input type="hidden" name="appointmentId" value={selectedAppointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Elimina appuntamento
                  </button>
                </form>
              </div>
            ) : (
              <AppointmentCreateForm
                patients={patients}
                doctors={doctors}
                serviceOptions={serviceOptions}
                availabilityWindows={availabilityWindows}
                practiceClosures={practiceClosures}
                practiceWeeklyClosures={practiceWeeklyClosures}
                action={action}
                initialStartsAt={selectedSlot?.startsAt}
                initialEndsAt={selectedSlot?.endsAt}
                initialDoctorId={selectedDoctorId}
                returnTo={returnTo}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
