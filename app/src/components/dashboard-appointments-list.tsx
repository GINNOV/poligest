"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { normalizeItalianPhone } from "@/lib/phone";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";
import { Button } from "./ui/button";
import { getBrowserUserDisplayTimeZone, formatDateInDisplayTimeZone, formatDateInputValueInTimeZone } from "@/lib/user-display-time-zone";
import { AppointmentStatusAutoSubmit } from "@/components/appointment-status-auto-submit";
import { AgendaReminderButton } from "@/components/agenda-reminder-button";
import { updateAppointmentStatusAction } from "@/lib/appointments/agenda-actions";
import { formatCalendarLocalInput } from "@/lib/calendar/domain";

type AppointmentItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  title: string;
  serviceType?: string | null;
  notes?: string | null;
  patient: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  doctor?: { id: string; fullName?: string | null } | null;
  reminderSent?: boolean;
};

type Props = {
  appointments: AppointmentItem[];
  whatsappTemplateBody: string;
  nowIso: string;
  emptyLabel: string;
};

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value: value as AppointmentStatus,
  label,
}));

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:border-amber-800/60 dark:from-amber-900/20 dark:via-zinc-950 dark:to-amber-900/20",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 dark:border-emerald-800/60 dark:from-emerald-900/20 dark:via-zinc-950 dark:to-emerald-900/20",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 dark:border-zinc-800/60 dark:from-zinc-900/20 dark:via-zinc-950 dark:to-zinc-900/20",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 dark:border-sky-800/60 dark:from-sky-900/20 dark:via-zinc-950 dark:to-sky-900/20",
  COMPLETED: "border-teal-200 bg-gradient-to-r from-teal-50 via-white to-teal-50 dark:border-teal-800/60 dark:from-teal-900/20 dark:via-zinc-950 dark:to-teal-900/20",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50 dark:border-rose-800/60 dark:from-rose-900/20 dark:via-zinc-950 dark:to-rose-900/20",
  NO_SHOW: "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-violet-50 dark:border-violet-800/60 dark:from-violet-900/20 dark:via-zinc-950 dark:to-violet-900/20",
};

const getServiceIcon = (serviceType?: string | null, title?: string | null) => {
  const label = `${serviceType ?? ""} ${title ?? ""}`.toLowerCase();
  if (label.includes("richiamo")) return "🔗";
  if (label.includes("prima visita")) return "📋";
  if (label.includes("urgente") || label.includes("urgenza")) return "🚨";
  if (label.includes("visita di controllo")) return "🔎";
  return "🗓️";
};

export function DashboardAppointmentsList({ appointments, whatsappTemplateBody, nowIso, emptyLabel }: Props) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [page, setPage] = useState(1);

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const displayTimeZone = useSyncExternalStore(
    () => () => {},
    () => getBrowserUserDisplayTimeZone(),
    () => "UTC"
  );

  const orderedAppointments = useMemo(() => {
    const parsed = appointments.map((appt) => ({
      ...appt,
      startsAtDate: new Date(appt.startsAt),
      endsAtDate: new Date(appt.endsAt),
    }));

    return parsed.sort((a, b) => {
      const dateA = a.startsAtDate.toISOString().split("T")[0];
      const dateB = b.startsAtDate.toISOString().split("T")[0];

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // Latest date first
      }

      const nameA = `${a.patient.lastName} ${a.patient.firstName}`.toLowerCase();
      const nameB = `${b.patient.lastName} ${b.patient.firstName}`.toLowerCase();

      return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
    });
  }, [appointments]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(orderedAppointments.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedAppointments = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return orderedAppointments.slice(start, start + PAGE_SIZE);
  }, [orderedAppointments, safeCurrentPage]);

  if (orderedAppointments.length === 0) {
    return <p className="py-4 text-sm text-zinc-600 dark:text-zinc-300">{emptyLabel}</p>;
  }

  return (
    <>
      {paginatedAppointments.map((appt, index) => {
        const patientPhone = normalizeItalianPhone(appt.patient.phone);
        const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
        const appointmentDoctor = appt.doctor?.fullName ?? "da definire";
        const whatsappAppointmentDate = isMounted ? formatDateInDisplayTimeZone(
          appt.startsAtDate,
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          },
          displayTimeZone
        ) : "";

        const whatsappMessage = renderWhatsappTemplate(whatsappTemplateBody, {
          firstName: appt.patient.firstName ?? "",
          lastName: appt.patient.lastName ?? "",
          doctorName: appointmentDoctor,
          appointmentDate: whatsappAppointmentDate,
          serviceType: appt.serviceType ?? "",
          notes: appt.notes ?? "",
        });
        const whatsappHref = whatsappPhone
          ? `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}`
          : null;
        const isPast = appt.endsAtDate < now;
        
        const cardClass = isPast
          ? "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20"
          : statusCardBackgrounds[appt.status];

        const dayKey = isMounted ? formatDateInputValueInTimeZone(appt.startsAtDate, displayTimeZone) : appt.startsAt.slice(0, 10);
        const dayLabel = isMounted ? formatDateInDisplayTimeZone(appt.startsAtDate, { dateStyle: "long" }, displayTimeZone) : "";
        const prevAppt = index > 0 ? paginatedAppointments[index - 1] : null;
        const prevDayKey = prevAppt 
          ? (isMounted ? formatDateInputValueInTimeZone(prevAppt.startsAtDate, displayTimeZone) : prevAppt.startsAt.slice(0, 10))
          : null;
        const showDivider = !prevDayKey || prevDayKey !== dayKey;

        const outerCardClass = index % 2 === 0
          ? "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90"
          : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80";

        const startsAtLocal = formatCalendarLocalInput(appt.startsAtDate, displayTimeZone);

        return (
          <div key={appt.id}>
            {showDivider && isMounted ? (
              <div className="mb-3 mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  📅 {dayLabel}
                </span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ) : null}
            <div className={`mb-4 rounded-2xl border p-4 shadow-sm ${outerCardClass}`}>
              <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      <span>
                        {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                      </span>
                      {isPast ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                          ✅ Passato
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-800 dark:text-zinc-200 sm:grid-cols-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">Paziente</span>
                        <Link
                          href={`/pazienti/${appt.patient.id}`}
                          className="font-semibold hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          {appt.patient.lastName} {appt.patient.firstName}
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">Medico</span>
                        <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">Quando</span>
                        <span>
                          {isMounted ? formatDateInDisplayTimeZone(
                            appt.startsAtDate,
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            },
                            displayTimeZone
                          ) : ""}
                          {" "}
                          alle {isMounted ? formatDateInDisplayTimeZone(appt.startsAtDate, { timeStyle: "short" }, displayTimeZone) : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">Durata</span>
                        <span>
                          {Math.max(
                            1,
                            Math.round(
                              (appt.endsAtDate.getTime() - appt.startsAtDate.getTime()) / (1000 * 60 * 60)
                            )
                          )}{" "}
                          ora/e
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Note</p>
                      <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 italic">
                        {appt.notes?.trim() ? appt.notes : "Nessuna nota."}
                      </p>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2 text-xs sm:w-auto">
                    <AgendaReminderButton
                      appointmentId={appt.id}
                      whatsappHref={whatsappHref}
                      initialReminderSent={appt.reminderSent}
                    />
                    <AppointmentStatusAutoSubmit
                      appointmentId={appt.id}
                      defaultValue={appt.status}
                      options={statusOptions}
                      action={updateAppointmentStatusAction}
                      returnTo="/dashboard"
                      className="w-full"
                    />
                    <Link
                      href={`/calendar?view=week&week=${startsAtLocal.split("T")[0]}&edit=${appt.id}${appt.doctor?.id ? `&doctor=${appt.doctor.id}` : ""}`}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    >
                      MODIFICA / CALENDARIO 🗓️
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Pagina {safeCurrentPage} di {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              variant="outline"
              size="sm"
            >
              Indietro
            </Button>
            <Button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Avanti
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
