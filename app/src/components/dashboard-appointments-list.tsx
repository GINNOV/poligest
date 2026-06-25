"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
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
  reminderSendCount?: number;
};

type LayoutMode = "rows" | "cards";

type Props = {
  appointments: AppointmentItem[];
  whatsappTemplateBody: string;
  nowIso: string;
  emptyLabel: string;
  layout?: LayoutMode;
};

type ParsedAppointment = AppointmentItem & {
  startsAtDate: Date;
  endsAtDate: Date;
};

type AppointmentRowContext = {
  appt: ParsedAppointment;
  isMounted: boolean;
  displayTimeZone: string;
  now: Date;
  whatsappTemplateBody: string;
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

const statusRowAccents: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-l-amber-400 bg-amber-50/40 dark:border-l-amber-500 dark:bg-amber-950/20",
  CONFIRMED: "border-l-emerald-400 bg-white dark:border-l-emerald-500 dark:bg-zinc-950",
  IN_WAITING: "border-l-zinc-300 bg-white dark:border-l-zinc-600 dark:bg-zinc-950",
  IN_PROGRESS: "border-l-sky-400 bg-sky-50/30 dark:border-l-sky-500 dark:bg-sky-950/20",
  COMPLETED: "border-l-teal-400 bg-teal-50/30 dark:border-l-teal-500 dark:bg-teal-950/20",
  CANCELLED: "border-l-rose-400 bg-rose-50/30 dark:border-l-rose-500 dark:bg-rose-950/20",
  NO_SHOW: "border-l-violet-400 bg-violet-50/30 dark:border-l-violet-500 dark:bg-violet-950/20",
};

const getServiceIcon = (serviceType?: string | null, title?: string | null) => {
  const label = `${serviceType ?? ""} ${title ?? ""}`.toLowerCase();
  if (label.includes("richiamo")) return "🔗";
  if (label.includes("prima visita")) return "📋";
  if (label.includes("urgente") || label.includes("urgenza")) return "🚨";
  if (label.includes("visita di controllo")) return "🔎";
  return "🗓️";
};

const getServiceLabel = (serviceType?: string | null, title?: string | null) =>
  serviceType?.trim() || title?.trim() || "—";

function buildAppointmentContext({
  appt,
  isMounted,
  displayTimeZone,
  whatsappTemplateBody,
}: Omit<AppointmentRowContext, "now">) {
  const patientPhone = normalizeItalianPhone(appt.patient.phone);
  const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
  const appointmentDoctor = appt.doctor?.fullName ?? "da definire";
  const whatsappAppointmentDate = isMounted
    ? formatDateInDisplayTimeZone(
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
      )
    : "";
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
  const startsAtLocal = formatCalendarLocalInput(appt.startsAtDate, displayTimeZone);

  return {
    patientPhone,
    whatsappHref,
    startsAtLocal,
    serviceLabel: getServiceLabel(appt.serviceType, appt.title),
  };
}

function AppointmentActions({
  appt,
  whatsappHref,
  startsAtLocal,
  className,
  variant = "stack",
}: {
  appt: ParsedAppointment;
  whatsappHref: string | null;
  startsAtLocal: string;
  className?: string;
  variant?: "stack" | "compact";
}) {
  const isCompact = variant === "compact";
  const containerClass = isCompact
    ? "flex items-center justify-end gap-1.5"
    : (className ?? "grid w-full grid-cols-1 gap-2 text-xs sm:w-auto");

  return (
    <div className={containerClass}>
      <AgendaReminderButton
        appointmentId={appt.id}
        whatsappHref={whatsappHref}
        initialReminderSent={appt.reminderSent}
        initialReminderSendCount={appt.reminderSendCount}
        size={isCompact ? "compact" : "default"}
      />
      <AppointmentStatusAutoSubmit
        appointmentId={appt.id}
        defaultValue={appt.status}
        options={statusOptions}
        action={updateAppointmentStatusAction}
        returnTo="/dashboard"
        className={isCompact ? "w-auto" : "w-full"}
        size={isCompact ? "compact" : "default"}
      />
      <Link
        href={`/calendar?view=week&week=${startsAtLocal.split("T")[0]}&edit=${appt.id}${appt.doctor?.id ? `&doctor=${appt.doctor.id}` : ""}`}
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white font-medium text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-800/50 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300 ${
          isCompact ? "h-8 px-2.5 text-[11px] whitespace-nowrap" : "gap-2 px-4 py-2 text-[10px]"
        }`}
      >
        {isCompact ? (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M6 3v2M14 3v2M4 7h12M5 5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            </svg>
            Calendario
          </>
        ) : (
          "MODIFICA / CALENDARIO 🗓️"
        )}
      </Link>
    </div>
  );
}

function DayDivider({
  dayLabel,
  colSpan,
}: {
  dayLabel: string;
  colSpan?: number;
}) {
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} className="bg-zinc-50 px-4 py-2 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              📅 {dayLabel}
            </span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="mb-3 mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        📅 {dayLabel}
      </span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

function PaginationControls({
  safeCurrentPage,
  totalPages,
  onPageChange,
}: {
  safeCurrentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-zinc-700 dark:text-zinc-300">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Pagina {safeCurrentPage} di {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage === 1}
          variant="outline"
          size="sm"
        >
          Indietro
        </Button>
        <Button
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage === totalPages}
          variant="outline"
          size="sm"
        >
          Avanti
        </Button>
      </div>
    </div>
  );
}

export function DashboardAppointmentsList({
  appointments,
  whatsappTemplateBody,
  nowIso,
  emptyLabel,
  layout = "rows",
}: Props) {
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
    const parsed: ParsedAppointment[] = appointments.map((appt) => ({
      ...appt,
      startsAtDate: new Date(appt.startsAt),
      endsAtDate: new Date(appt.endsAt),
    }));

    return parsed.sort((a, b) => {
      const dateA = isMounted
        ? formatDateInputValueInTimeZone(a.startsAtDate, displayTimeZone)
        : a.startsAtDate.toISOString().split("T")[0];
      const dateB = isMounted
        ? formatDateInputValueInTimeZone(b.startsAtDate, displayTimeZone)
        : b.startsAtDate.toISOString().split("T")[0];

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      if (layout === "rows") {
        return a.startsAtDate.getTime() - b.startsAtDate.getTime();
      }

      const nameA = `${a.patient.lastName} ${a.patient.firstName}`.toLowerCase();
      const nameB = `${b.patient.lastName} ${b.patient.firstName}`.toLowerCase();

      return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
    });
  }, [appointments, displayTimeZone, isMounted, layout]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(orderedAppointments.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedAppointments = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return orderedAppointments.slice(start, start + PAGE_SIZE);
  }, [orderedAppointments, safeCurrentPage]);

  const getDayMeta = (appt: ParsedAppointment, prevAppt: ParsedAppointment | null) => {
    const dayKey = isMounted
      ? formatDateInputValueInTimeZone(appt.startsAtDate, displayTimeZone)
      : appt.startsAt.slice(0, 10);
    const dayLabel = isMounted
      ? formatDateInDisplayTimeZone(appt.startsAtDate, { dateStyle: "long" }, displayTimeZone)
      : "";
    const prevDayKey = prevAppt
      ? isMounted
        ? formatDateInputValueInTimeZone(prevAppt.startsAtDate, displayTimeZone)
        : prevAppt.startsAt.slice(0, 10)
      : null;
    const showDivider = !prevDayKey || prevDayKey !== dayKey;

    return { dayLabel, showDivider };
  };

  const getRowClass = (appt: ParsedAppointment, mode: LayoutMode = layout) => {
    const isPast = appt.endsAtDate < now;
    if (mode === "rows") {
      return isPast
        ? "border-l-amber-300 bg-amber-50/50 dark:border-l-amber-500 dark:bg-amber-950/25"
        : statusRowAccents[appt.status];
    }
    return isPast
      ? "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20"
      : statusCardBackgrounds[appt.status];
  };

  if (orderedAppointments.length === 0) {
    return <p className="py-4 text-sm text-zinc-600 dark:text-zinc-300">{emptyLabel}</p>;
  }

  if (layout === "rows") {
    const rowHeaderClass =
      "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

    return (
      <>
        <div className="relative overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[48rem] divide-y divide-zinc-100 dark:divide-zinc-800">
            <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
              <tr>
                <th className={`${rowHeaderClass} w-[4.5rem]`}>Ora</th>
                <th className={`${rowHeaderClass} min-w-[9rem]`}>Paziente</th>
                <th className={`${rowHeaderClass} min-w-[8rem]`}>Telefono</th>
                <th className={rowHeaderClass}>Prestazione</th>
                <th className={`${rowHeaderClass} w-[1%] text-right`}>Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {paginatedAppointments.map((appt, index) => {
                const { patientPhone, whatsappHref, startsAtLocal, serviceLabel } = buildAppointmentContext({
                  appt,
                  isMounted,
                  displayTimeZone,
                  whatsappTemplateBody,
                });
                const { dayLabel, showDivider } = getDayMeta(
                  appt,
                  index > 0 ? paginatedAppointments[index - 1] : null
                );
                const rowClass = getRowClass(appt, "rows");
                const isPast = appt.endsAtDate < now;
                const patientName = `${appt.patient.lastName} ${appt.patient.firstName}`.trim();

                return (
                  <Fragment key={appt.id}>
                    {showDivider && isMounted ? <DayDivider dayLabel={dayLabel} colSpan={5} /> : null}
                    <tr className={`border-l-[3px] transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 ${rowClass}`}>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {isMounted
                            ? formatDateInDisplayTimeZone(appt.startsAtDate, { timeStyle: "short" }, displayTimeZone)
                            : "—"}
                        </span>
                        {isPast ? (
                          <span className="mt-0.5 block text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            Passato
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/pazienti/${appt.patient.id}`}
                          className="text-sm font-medium text-zinc-900 hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-300"
                          title={patientName}
                        >
                          {patientName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400" title={patientPhone ?? undefined}>
                          {patientPhone ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300" title={serviceLabel}>
                          <span className="shrink-0 text-sm leading-none opacity-80">{getServiceIcon(appt.serviceType, appt.title)}</span>
                          <span className="truncate">{serviceLabel}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 align-middle">
                        <AppointmentActions
                          appt={appt}
                          whatsappHref={whatsappHref}
                          startsAtLocal={startsAtLocal}
                          variant="compact"
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls
          safeCurrentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <>
      {paginatedAppointments.map((appt, index) => {
        const { whatsappHref, startsAtLocal } = buildAppointmentContext({
          appt,
          isMounted,
          displayTimeZone,
          whatsappTemplateBody,
        });
        const cardClass = getRowClass(appt);
        const { dayLabel, showDivider } = getDayMeta(
          appt,
          index > 0 ? paginatedAppointments[index - 1] : null
        );
        const isPast = appt.endsAtDate < now;
        const outerCardClass =
          index % 2 === 0
            ? "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90"
            : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80";

        return (
          <div key={appt.id}>
            {showDivider && isMounted ? <DayDivider dayLabel={dayLabel} /> : null}
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
                          {isMounted
                            ? formatDateInDisplayTimeZone(
                                appt.startsAtDate,
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                },
                                displayTimeZone
                              )
                            : ""}{" "}
                          alle{" "}
                          {isMounted
                            ? formatDateInDisplayTimeZone(appt.startsAtDate, { timeStyle: "short" }, displayTimeZone)
                            : ""}
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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Note
                      </p>
                      <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 italic">
                        {appt.notes?.trim() ? appt.notes : "Nessuna nota."}
                      </p>
                    </div>
                  </div>
                  <AppointmentActions appt={appt} whatsappHref={whatsappHref} startsAtLocal={startsAtLocal} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <PaginationControls
        safeCurrentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}
