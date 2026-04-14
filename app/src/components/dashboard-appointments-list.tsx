"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { normalizeItalianPhone } from "@/lib/phone";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";
import { Button } from "./ui/button";
import { getBrowserUserDisplayTimeZone } from "@/lib/user-display-time-zone";

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
  doctor?: { fullName?: string | null } | null;
  reminderSent?: boolean;
};

type Props = {
  appointments: AppointmentItem[];
  whatsappTemplateBody: string;
  nowIso: string;
  emptyLabel: string;
};

const LOCALE = "it-IT";
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions, timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
const getDateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:border-amber-800/60 dark:from-amber-900/20 dark:via-zinc-950 dark:to-amber-900/20",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 dark:border-emerald-800/60 dark:from-emerald-900/20 dark:via-zinc-950 dark:to-emerald-900/20",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 dark:border-zinc-800/60 dark:from-zinc-900/20 dark:via-zinc-950 dark:to-zinc-900/20",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 dark:border-sky-800/60 dark:from-sky-900/20 dark:via-zinc-950 dark:to-sky-900/20",
  COMPLETED: "border-teal-200 bg-gradient-to-r from-teal-50 via-white to-teal-50 dark:border-teal-800/60 dark:from-teal-900/20 dark:via-zinc-950 dark:to-teal-900/20",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50 dark:border-rose-800/60 dark:from-rose-900/20 dark:via-zinc-950 dark:to-rose-900/20",
  NO_SHOW: "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-violet-50 dark:border-violet-800/60 dark:from-violet-900/20 dark:via-zinc-950 dark:to-violet-900/20",
};

const PAGE_SIZE = 10;

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
  const [displayTimeZone, setDisplayTimeZone] = useState("UTC");
  const [isMounted, setIsMounted] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setDisplayTimeZone(getBrowserUserDisplayTimeZone());
    setIsMounted(true);
  }, []);

  const orderedAppointments = useMemo(() => {
    const isSameDay = (date: Date, target: Date) =>
      getDateKey(date, displayTimeZone) === getDateKey(target, displayTimeZone);
    const parsed = appointments.map((appt) => ({
      ...appt,
      startsAtDate: new Date(appt.startsAt),
      endsAtDate: new Date(appt.endsAt),
    }));
    return [
      ...parsed
        .filter((appt) => isSameDay(appt.startsAtDate, now))
        .sort((a, b) => a.startsAtDate.getTime() - b.startsAtDate.getTime()),
      ...parsed
        .filter((appt) => appt.startsAtDate > now && !isSameDay(appt.startsAtDate, now))
        .sort((a, b) => a.startsAtDate.getTime() - b.startsAtDate.getTime()),
      ...parsed
        .filter((appt) => appt.startsAtDate < now && !isSameDay(appt.startsAtDate, now))
        .sort((a, b) => b.startsAtDate.getTime() - a.startsAtDate.getTime()),
    ];
  }, [appointments, displayTimeZone, now]);
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
        const whatsappAppointmentDate = isMounted ? formatDate(
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
        const dayKey = getDateKey(appt.startsAtDate, displayTimeZone);
        const dayLabel = isMounted ? formatDate(appt.startsAtDate, { dateStyle: "long" }, displayTimeZone) : "";
        const prevAppt = index > 0 ? paginatedAppointments[index - 1] : null;
        const prevDayKey = prevAppt ? getDateKey(prevAppt.startsAtDate, displayTimeZone) : null;
        const showDivider = !prevDayKey || prevDayKey !== dayKey;
        const reminderSent = appt.reminderSent;
        const outerCardClass = index % 2 === 0
          ? "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90"
          : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80";

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
                          {isMounted ? formatDate(
                            appt.startsAtDate,
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            },
                            displayTimeZone
                          ) : ""}
                          {" "}
                          alle {isMounted ? formatDate(appt.startsAtDate, { timeStyle: "short" }, displayTimeZone) : ""}
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
                  </div>
                  <div className="flex justify-end">
                    <Button
                      disabled={!whatsappHref}
                      onClick={() => {
                        if (!whatsappHref) return;
                        const clickLogUrl = `/api/appointments/${appt.id}/whatsapp-reminder-click`;
                        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
                          navigator.sendBeacon(clickLogUrl, new Blob(["{}"], { type: "application/json" }));
                        } else {
                          void fetch(clickLogUrl, {
                            method: "POST",
                            keepalive: true,
                            headers: { "content-type": "application/json" },
                            body: "{}",
                          });
                        }
                        window.location.href = whatsappHref;
                      }}
                      variant={reminderSent ? "primary" : "destructive"}
                      className="h-9 w-full gap-2 sm:w-auto"
                    >
                      <Image src="/whatsapp.png" alt="" width={18} height={18} />
                      Promemoria
                    </Button>
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
