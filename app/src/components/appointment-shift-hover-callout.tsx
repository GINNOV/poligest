"use client";

import { useEffect, useState } from "react";

export type CalendarAppointmentTile = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  hStart: number;
  mStart: number;
  hEnd: number;
  mEnd: number;
  serviceType: string;
  patientName: string;
  patientId: string;
  doctorId: string | null;
  status: string;
  notes?: string | null;
};

export type DoctorOption = {
  id: string;
  fullName: string;
  specialty?: string | null;
  color?: string | null;
};

export type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
};

export function useAppointmentShiftHover() {
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [hoveredAppt, setHoveredAppt] = useState<CalendarAppointmentTile | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" || e.shiftKey) {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift" || !e.shiftKey) {
        setIsShiftPressed(false);
      }
    };
    const handleBlur = () => {
      setIsShiftPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const getHoverHandlers = (appt: CalendarAppointmentTile) => {
    return {
      onMouseEnter: (e: React.MouseEvent) => {
        setHoveredAppt(appt);
        setMousePos({ x: e.clientX, y: e.clientY });
        if (e.shiftKey) setIsShiftPressed(true);
      },
      onMouseMove: (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
        if (e.shiftKey) setIsShiftPressed(true);
      },
      onMouseLeave: () => {
        setHoveredAppt(null);
      },
    };
  };

  return {
    isShiftPressed,
    hoveredAppt,
    mousePos,
    getHoverHandlers,
  };
}

export function AppointmentShiftHoverCallout({
  hoveredAppt,
  isShiftPressed,
  mousePos,
  doctors = [],
  patients = [],
}: {
  hoveredAppt: CalendarAppointmentTile | null;
  isShiftPressed: boolean;
  mousePos: { x: number; y: number };
  doctors?: DoctorOption[];
  patients?: PatientOption[];
}) {
  if (!hoveredAppt || !isShiftPressed) return null;

  const doctor = doctors.find((d) => d.id === hoveredAppt.doctorId);
  const patient = patients.find((p) => p.id === hoveredAppt.patientId);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const startTimeStr = `${pad(hoveredAppt.hStart)}:${pad(hoveredAppt.mStart)}`;
  const endTimeStr = `${pad(hoveredAppt.hEnd)}:${pad(hoveredAppt.mEnd)}`;

  const apptDateStr = hoveredAppt.startsAt.split("T")[0];

  const statusLabel =
    hoveredAppt.status === "CONFIRMED"
      ? "Confermato"
      : hoveredAppt.status === "COMPLETED"
        ? "Completato"
        : hoveredAppt.status === "CANCELLED"
          ? "Annullato"
          : hoveredAppt.status === "NO_SHOW"
            ? "Assente"
            : hoveredAppt.status;

  const cardWidth = 300;
  const cardHeight = 220;

  const left =
    typeof window !== "undefined" && mousePos.x + cardWidth + 20 > window.innerWidth
      ? Math.max(10, mousePos.x - cardWidth - 12)
      : mousePos.x + 16;

  const top =
    typeof window !== "undefined" && mousePos.y + cardHeight + 20 > window.innerHeight
      ? Math.max(10, mousePos.y - cardHeight - 12)
      : mousePos.y + 16;

  return (
    <div
      style={{ left: `${left}px`, top: `${top}px` }}
      className="pointer-events-none fixed z-[9999] w-[300px] rounded-2xl border border-zinc-200/90 bg-white/95 p-4 text-xs shadow-2xl backdrop-blur-md transition-all duration-75 dark:border-zinc-800/90 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          {hoveredAppt.serviceType}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {statusLabel}
        </span>
      </div>

      <div className="mt-2 text-sm font-bold text-zinc-950 dark:text-zinc-50">
        {hoveredAppt.patientName}
      </div>

      <div className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">
        {hoveredAppt.title}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950/50">
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">ORARIO</div>
          <div className="font-bold text-zinc-800 dark:text-zinc-200">
            {startTimeStr} - {endTimeStr}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400">DATA</div>
          <div className="font-bold text-zinc-800 dark:text-zinc-200">{apptDateStr}</div>
        </div>
      </div>

      {doctor ? (
        <div className="mt-2 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-400">Medico:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {doctor.fullName}
          </span>
        </div>
      ) : null}

      {patient?.phone || patient?.email ? (
        <div className="mt-1 space-y-0.5 text-zinc-500 dark:text-zinc-400">
          {patient.phone ? (
            <div>
              <span className="font-semibold text-zinc-400">Tel:</span> {patient.phone}
            </div>
          ) : null}
          {patient.email ? (
            <div className="truncate">
              <span className="font-semibold text-zinc-400">Email:</span> {patient.email}
            </div>
          ) : null}
        </div>
      ) : null}

      {hoveredAppt.notes ? (
        <div className="mt-2.5 border-t border-zinc-100 pt-2 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300 italic">
          &quot;{hoveredAppt.notes}&quot;
        </div>
      ) : null}
    </div>
  );
}
