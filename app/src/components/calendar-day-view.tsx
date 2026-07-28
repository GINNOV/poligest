"use client";

import { useMemo, useState } from "react";
import { AppointmentCreateForm } from "@/components/appointment-create-form";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import {
  AppointmentShiftHoverCallout,
  useAppointmentShiftHover,
} from "@/components/appointment-shift-hover-callout";
import type { CalendarAppointment } from "@/lib/calendar/layout-engine";

type AvailabilityWindow = {
  startMinute: number;
  endMinute: number;
  color: string;
  doctorId?: string;
};

export type DayViewColumn = {
  date: string;
  label: string;
  isToday: boolean;
  isPracticeClosed?: boolean;
  isDoctorOnTimeOff?: boolean;
  availabilityWindows: AvailabilityWindow[];
  appointments: CalendarAppointment[];
};

type Doctor = {
  id: string;
  fullName: string;
  specialty: string;
  color?: string | null;
};

type Props = {
  dayDateKey: string;
  dayFormattedTitle: string;
  columns: DayViewColumn[];
  patients: Array<{ id: string; name: string; taxId?: string; birthDate?: string | null }>;
  doctors: Doctor[];
  serviceOptions: string[];
  services?: Array<{ id: string; name: string }>;
  availabilityWindows: Array<{
    doctorId: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
  practiceClosures?: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    reason?: string | null;
  }>;
  practiceWeeklyClosures?: Array<{
    dayOfWeek: number;
    isActive: boolean;
  }>;
  doctorTimeOffs?: Array<{
    id: string;
    doctorId: string;
    startsAt: string;
    endsAt: string;
    reason?: string | null;
  }>;
  action: (formData: FormData) => Promise<unknown>;
  updateAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
  displayTimeZone: string;
  selectedDoctorId?: string;
  returnTo: string;
  searchQuery?: string;
  initialAppointmentId?: string;
};

const SERVICE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; pill: string }
> = {
  "prima visita": {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-300 dark:border-sky-700",
    text: "text-sky-950 dark:text-sky-100",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
  },
  "visita di controllo": {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-950 dark:text-emerald-100",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  },
  urgenza: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-950 dark:text-rose-100",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100",
  },
  igiene: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-700",
    text: "text-teal-950 dark:text-teal-100",
    pill: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100",
  },
  ortodonzia: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-700",
    text: "text-purple-950 dark:text-purple-100",
    pill: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-100",
  },
  chirurgia: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-950 dark:text-amber-100",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  },
  implantologia: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-300 dark:border-indigo-700",
    text: "text-indigo-950 dark:text-indigo-100",
    pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100",
  },
  protesi: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
    text: "text-blue-950 dark:text-blue-100",
    pill: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100",
  },
};

const DEFAULT_SERVICE_STYLE = {
  bg: "bg-emerald-50 dark:bg-emerald-950/40",
  border: "border-emerald-300 dark:border-emerald-700",
  text: "text-emerald-950 dark:text-emerald-100",
  pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  TO_CONFIRM: {
    label: "Da confermare",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  CONFIRMED: {
    label: "Confermato",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  },
  IN_WAITING: {
    label: "In attesa",
    className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700",
  },
  IN_PROGRESS: {
    label: "In corso",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200 border-sky-200 dark:border-sky-800",
  },
  COMPLETED: {
    label: "Completato",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200 border-teal-200 dark:border-teal-800",
  },
  CANCELLED: {
    label: "Annullato",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border-rose-200 dark:border-rose-800",
  },
  NO_SHOW: {
    label: "No-show",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200 border-violet-200 dark:border-violet-800",
  },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

export function CalendarDayView({
  dayDateKey,
  dayFormattedTitle,
  columns,
  patients,
  doctors,
  serviceOptions,
  services,
  action,
  updateAction,
  deleteAction,
  displayTimeZone,
  selectedDoctorId,
  returnTo,
  searchQuery,
  initialAppointmentId,
}: Props) {
  const [createSlot, setCreateSlot] = useState<{
    startsAt: string;
    doctorId?: string;
  } | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<CalendarAppointment | null>(null);

  const initialMatchingAppointment = useMemo(() => {
    if (!initialAppointmentId) return null;
    for (const col of columns) {
      const match = col.appointments.find((a) => a.id === initialAppointmentId);
      if (match) return match;
    }
    return null;
  }, [initialAppointmentId, columns]);

  const editingAppointment = selectedAppointment ?? initialMatchingAppointment;

  const { hoveredAppointmentId, mousePos, handleMouseEnter, handleMouseLeave } =
    useAppointmentShiftHover();

  const doctorMap = useMemo(
    () => new Map(doctors.map((d) => [d.id, d])),
    [doctors]
  );
  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  // Search filter
  const searchTokens = useMemo(() => {
    if (!searchQuery?.trim()) return [];
    return searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }, [searchQuery]);

  const filteredColumns = useMemo(() => {
    if (searchTokens.length === 0) return columns;
    return columns.map((col) => ({
      ...col,
      appointments: col.appointments.filter((appt) => {
        const patientObj = patientMap.get(appt.patientId);
        const text = [
          appt.title,
          appt.serviceType,
          appt.notes ?? "",
          appt.patientName,
          patientObj?.taxId ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchTokens.every((token) => text.includes(token));
      }),
    }));
  }, [columns, searchTokens, patientMap]);

  // Aggregate all filtered appointments across columns
  const allDayAppointments = useMemo(() => {
    return filteredColumns.flatMap((col) => col.appointments);
  }, [filteredColumns]);

  const hoveredAppointment = useMemo(() => {
    if (!hoveredAppointmentId) return null;
    for (const col of columns) {
      const found = col.appointments.find((a) => a.id === hoveredAppointmentId);
      if (found) return found;
    }
    return null;
  }, [hoveredAppointmentId, columns]);

  const confirmedCount = allDayAppointments.filter(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  ).length;

  const isMultiColumn = columns.length > 1;

  const handleOpenCreateModal = (hour: number, doctorId?: string) => {
    const paddedHour = String(hour).padStart(2, "0");
    const startsAt = `${dayDateKey}T${paddedHour}:00`;
    setCreateSlot({ startsAt, doctorId });
  };

  return (
    <div className="space-y-6">
      {/* Day Overview Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 capitalize">
            {dayFormattedTitle}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Vista giorno centralizzata • Programmazione dettagliata oraria
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {allDayAppointments.length} Appuntament{allDayAppointments.length === 1 ? "o" : "i"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            ✓ {confirmedCount} Confermati
          </span>
          {allDayAppointments.length - confirmedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              ⏳ {allDayAppointments.length - confirmedCount} In attesa/Altro
            </span>
          ) : null}
        </div>
      </div>

      {/* Main Centered Agenda Grid */}
      <div className={isMultiColumn ? "w-full overflow-x-auto" : "mx-auto max-w-4xl"}>
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {/* Header Row: Doctors if multi-column */}
          {isMultiColumn ? (
            <div className="grid border-b border-zinc-200 dark:border-zinc-800" style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(240px, 1fr))` }}>
              <div className="p-3 text-center text-xs font-semibold text-zinc-400 border-r border-zinc-200 dark:border-zinc-800">
                Orario
              </div>
              {columns.map((col, idx) => {
                const docId = col.date.split("-")[1];
                const doctor = doctorMap.get(docId);
                const color = doctor?.color ?? "#10b981";
                return (
                  <div
                    key={col.date}
                    className={`p-3 text-center ${idx < columns.length - 1 ? "border-r border-zinc-200 dark:border-zinc-800" : ""}`}
                  >
                    <div className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {doctor?.fullName ?? col.label}
                      </span>
                    </div>
                    {doctor?.specialty ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {doctor.specialty}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Programma Orario
              </div>
              {selectedDoctorId && doctorMap.has(selectedDoctorId) ? (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: doctorMap.get(selectedDoctorId)?.color ?? "#10b981" }}
                  />
                  {doctorMap.get(selectedDoctorId)?.fullName}
                </div>
              ) : null}
            </div>
          )}

          {/* Timeline Rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {HOURS.map((hour) => {
              const formattedHour = `${String(hour).padStart(2, "0")}:00`;

              return (
                <div
                  key={hour}
                  className="grid transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                  style={{
                    gridTemplateColumns: isMultiColumn
                      ? `80px repeat(${columns.length}, minmax(240px, 1fr))`
                      : "80px 1fr",
                  }}
                >
                  {/* Time Label */}
                  <div className="flex items-start justify-center p-3 text-xs font-semibold text-zinc-400 border-r border-zinc-100 dark:border-zinc-800/60">
                    {formattedHour}
                  </div>

                  {/* Doctor Columns or Single Day Content */}
                  {filteredColumns.map((col, idx) => {
                    const docId = isMultiColumn ? col.date.split("-")[1] : selectedDoctorId;
                    const hourAppointments = col.appointments.filter(
                      (appt) => appt.hStart === hour
                    );

                    return (
                      <div
                        key={col.date}
                        className={`group relative min-h-[72px] p-2.5 ${
                          idx < filteredColumns.length - 1
                            ? "border-r border-zinc-100 dark:border-zinc-800/60"
                            : ""
                        }`}
                      >
                        {hourAppointments.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateModal(hour, docId)}
                            className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-transparent p-2 text-xs font-medium text-zinc-400 opacity-0 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 hover:opacity-100 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-300"
                          >
                            + Aggiungi appuntamento ({formattedHour})
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {hourAppointments.map((appt) => {
                              const styleKey = (appt.serviceType ?? "").toLowerCase();
                              const serviceStyle = SERVICE_STYLES[styleKey] ?? DEFAULT_SERVICE_STYLE;
                              const statusInfo = STATUS_BADGES[appt.status] ?? STATUS_BADGES.CONFIRMED;
                              const doctor = doctorMap.get(appt.doctorId);
                              const doctorColor = doctor?.color ?? "#10b981";

                              return (
                                <div
                                  key={appt.id}
                                  data-appointment-id={appt.id}
                                  onMouseEnter={(e) => handleMouseEnter(appt.id, e)}
                                  onMouseLeave={handleMouseLeave}
                                  onClick={() => setSelectedAppointment(appt)}
                                  className={`relative cursor-pointer rounded-xl border p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${serviceStyle.bg} ${serviceStyle.border}`}
                                >
                                  {/* Doctor Color Left Pillar */}
                                  <div
                                    className="absolute left-0 top-2.5 bottom-2.5 w-1.5 rounded-r-full"
                                    style={{ backgroundColor: doctorColor }}
                                  />

                                  <div className="pl-2.5 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                          {appt.startsAt.split("T")[1]?.slice(0, 5)} - {appt.endsAt.split("T")[1]?.slice(0, 5)}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusInfo.className}`}>
                                          {statusInfo.label}
                                        </span>
                                      </div>
                                      {appt.serviceType ? (
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${serviceStyle.pill}`}>
                                          {appt.serviceType}
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        {appt.patientName}
                                      </span>
                                      {doctor && !isMultiColumn ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: doctorColor }} />
                                          {doctor.fullName}
                                        </span>
                                      ) : null}
                                    </div>

                                    {appt.title && appt.title !== appt.serviceType ? (
                                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                        {appt.title}
                                      </div>
                                    ) : null}

                                    {appt.notes ? (
                                      <div className="text-xs italic text-zinc-500 line-clamp-1 dark:text-zinc-400">
                                        📝 {appt.notes}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Shift Hover Callout */}
      {hoveredAppointment && mousePos ? (
        <AppointmentShiftHoverCallout
          appointment={hoveredAppointment}
          patient={patientMap.get(hoveredAppointment.patientId)}
          doctorName={doctorMap.get(hoveredAppointment.doctorId)?.fullName}
          x={mousePos.x}
          y={mousePos.y}
        />
      ) : null}

      {/* Create Modal */}
      {createSlot ? (
        <AppointmentCreateForm
          isOpen={true}
          onClose={() => setCreateSlot(null)}
          action={action}
          patients={patients}
          doctors={doctors}
          serviceOptions={serviceOptions}
          services={services}
          defaultDoctorId={createSlot.doctorId ?? selectedDoctorId}
          defaultStartsAt={createSlot.startsAt}
          displayTimeZone={displayTimeZone}
          returnTo={returnTo}
        />
      ) : null}

      {/* Edit Modal */}
      {editingAppointment ? (
        <AppointmentUpdateForm
          isOpen={true}
          onClose={() => setSelectedAppointment(null)}
          action={updateAction}
          deleteAction={deleteAction}
          patients={patients}
          doctors={doctors}
          serviceOptions={serviceOptions}
          services={services}
          appointment={{
            id: editingAppointment.id,
            title: editingAppointment.title,
            startsAt: editingAppointment.startsAt,
            endsAt: editingAppointment.endsAt,
            serviceType: editingAppointment.serviceType,
            patientId: editingAppointment.patientId,
            doctorId: editingAppointment.doctorId,
            status: editingAppointment.status,
            notes: editingAppointment.notes,
          }}
          displayTimeZone={displayTimeZone}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}
