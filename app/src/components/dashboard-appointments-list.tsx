"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { normalizeItalianPhone } from "@/lib/phone";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";

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
};

type Props = {
  appointments: AppointmentItem[];
  whatsappTemplateBody: string;
  nowIso: string;
  emptyLabel: string;
};

const LOCALE = "it-IT";
const TIME_ZONE = "Europe/Rome";
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE }).format(date);
const getDateKey = (date: Date) => DATE_KEY_FORMATTER.format(date);

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50",
  COMPLETED: "border-green-200 bg-gradient-to-r from-green-50 via-white to-green-50",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50",
  NO_SHOW: "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50",
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
  const orderedAppointments = useMemo(() => {
    const isSameDay = (date: Date, target: Date) => getDateKey(date) === getDateKey(target);
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
  }, [appointments, now]);

  if (orderedAppointments.length === 0) {
    return <p className="py-4 text-sm text-zinc-600">{emptyLabel}</p>;
  }

  return (
    <>
      {orderedAppointments.map((appt, index) => {
        const patientPhone = normalizeItalianPhone(appt.patient.phone);
        const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
        const appointmentDoctor = appt.doctor?.fullName ?? "da definire";
        const whatsappAppointmentDate = formatDate(appt.startsAtDate, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
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
          ? "border-amber-200 bg-amber-50"
          : statusCardBackgrounds[appt.status];
        const dayKey = getDateKey(appt.startsAtDate);
        const dayLabel = formatDate(appt.startsAtDate, { dateStyle: "long" });
        const prevAppt = index > 0 ? orderedAppointments[index - 1] : null;
        const prevDayKey = prevAppt ? getDateKey(prevAppt.startsAtDate) : null;
        const showDivider = !prevDayKey || prevDayKey !== dayKey;
        const outerCardClass = index % 2 === 0
          ? "border-zinc-200 bg-white/90"
          : "border-zinc-200 bg-zinc-50/80";

        return (
          <div key={appt.id}>
            {showDivider ? (
              <div className="mb-3 mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                  📅 {dayLabel}
                </span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
            ) : null}
            <div className={`mb-4 rounded-2xl border p-4 shadow-sm ${outerCardClass}`}>
              <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                      <span>
                        {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                      </span>
                      {isPast ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          ✅ Passato
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-sm text-zinc-800 sm:grid-cols-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500">Paziente</span>
                        <Link
                          href={`/pazienti/${appt.patient.id}`}
                          className="font-semibold hover:text-emerald-700"
                        >
                          {appt.patient.lastName} {appt.patient.firstName}
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500">Medico</span>
                        <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500">Quando</span>
                        <span>
                          {formatDate(appt.startsAtDate, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          alle {formatDate(appt.startsAtDate, { timeStyle: "short" })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500">Durata</span>
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
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-600 sm:w-auto"
                      >
                        <Image src="/whatsapp.png" alt="" width={18} height={18} />
                        Promemoria
                      </a>
                    ) : (
                      <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-emerald-700/60 px-3 text-xs font-semibold text-white opacity-70 sm:w-auto">
                        <Image src="/whatsapp.png" alt="" width={18} height={18} />
                        Promemoria
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
