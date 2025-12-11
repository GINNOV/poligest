import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { DoctorFilter } from "@/components/doctor-filter";

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

const statusClasses: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800",
  COMPLETED: "border-green-200 bg-green-50 text-green-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
  NO_SHOW: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusIcons: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "📅",
  CONFIRMED: "✅",
  IN_WAITING: "⏳",
  IN_PROGRESS: "🔧",
  COMPLETED: "⭐",
  CANCELLED: "❌",
  NO_SHOW: "🚫",
};

type StatCardProps = { label: string; value: number };

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser([
    Role.ADMIN,
    Role.MANAGER,
    Role.SECRETARY,
    Role.PATIENT,
  ]);
  const t = await getTranslations("dashboard");
  const isPatient = user.role === Role.PATIENT;

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const viewParam = typeof params.view === "string" ? params.view : undefined;
  const view = viewParam === "day" ? "day" : "week";

  const selectedDayParam = typeof params.day === "string" ? params.day : undefined;
  const selectedDay =
    selectedDayParam && !Number.isNaN(Date.parse(selectedDayParam))
      ? selectedDayParam
      : format(today, "yyyy-MM-dd");

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(isPatient
        ? {
            patient: {
              email: { equals: user.email ?? "", mode: "insensitive" },
            },
          }
        : {}),
      startsAt: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { startsAt: "asc" },
    include: {
      patient: { select: { firstName: true, lastName: true, id: true, photoUrl: true } },
      doctor: { select: { fullName: true, specialty: true } },
    },
  });

  const uniquePatientsWeek = new Set(appointments.map((a) => a.patientId)).size;

  const perDay = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayAppointments = appointments.filter(
      (appt) => format(appt.startsAt, "yyyy-MM-dd") === key
    );
    const uniquePatients = new Set(dayAppointments.map((a) => a.patientId)).size;
    return { key, label: format(day, "EEE d", { locale: it }), count: uniquePatients };
  });

  const maxCount = Math.max(...perDay.map((d) => d.count), 1);
  const selectedAppointments = appointments.filter(
    (appt) => format(appt.startsAt, "yyyy-MM-dd") === selectedDay
  );
  const doctors = Array.from(
    new Map(
      appointments
        .filter((a) => a.doctor?.fullName)
        .map((a) => [a.doctor?.fullName ?? "", a.doctor?.fullName ?? ""])
    ).values()
  );
  const selectedDoctor =
    typeof params.doctor === "string"
      ? params.doctor
      : Array.isArray(params.doctor)
        ? params.doctor[0] ?? ""
        : "";
  const filteredByDoctor =
    selectedDoctor && selectedDoctor !== "all"
      ? (view === "day" ? selectedAppointments : appointments).filter(
          (appt) => (appt.doctor?.fullName ?? "") === selectedDoctor
        )
      : view === "day"
        ? selectedAppointments
        : appointments;
  const listAppointments = filteredByDoctor;

  if (isPatient) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-zinc-600">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {user.name ?? user.email}
          </h1>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">I tuoi appuntamenti</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {listAppointments.length}
            </span>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {listAppointments.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">{t("empty")}</p>
            ) : (
              listAppointments.map((appt) => (
                <div key={appt.id} className="py-4 first:pt-2 last:pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          <span aria-hidden="true">
                            {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                            (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                              ? "🦷"
                              : "❤️"}
                          </span>
                          {appt.title}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                          {appt.serviceType}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-800">
                        🧑‍⚕️ Paziente {appt.patient.lastName} {appt.patient.firstName} è stato visto da{" "}
                        <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                        {appt.doctor?.specialty ? `(${appt.doctor.specialty})` : ""} il{" "}
                        {new Intl.DateTimeFormat("it-IT", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(appt.startsAt)}{" "}
                        alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                      </p>
                      <p className="text-sm text-zinc-800">
                        🕒 Terminato previsto entro{" "}
                        {new Intl.DateTimeFormat("it-IT", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(appt.endsAt)}{" "}
                        alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.endsAt)}.
                      </p>
                    </div>
                    <span
                      className={`mt-1 inline-flex h-8 items-center rounded-full px-3 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                    >
                      {statusLabels[appt.status].toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {user.name ?? user.email}
          </h1>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Appuntamenti di questa settimana
          </h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {format(weekStart, "d MMM", { locale: it })} -{" "}
            {format(weekEnd, "d MMM", { locale: it })}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Clicca su un giorno per mostrare, nella lista sottostante, solo gli appuntamenti di quella data.
          Clicca il pulsante SETTIMANA per visualizzare tutti gli appuntamenti della settimana.
        </p>
        <div className="mt-4 grid grid-cols-7 items-end gap-2 sm:gap-3">
          {perDay.map((day) => (
            <Link
              key={day.key}
              href={`/dashboard?view=day&day=${day.key}`}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-2 transition ${
                day.key === selectedDay
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-zinc-100 bg-white hover:border-emerald-100"
              }`}
            >
              <div
                className="w-full rounded-full bg-emerald-200"
                style={{ height: `${Math.max((day.count / maxCount) * 120, 8)}px` }}
              />
              <span className="text-xs font-semibold text-zinc-800">{day.label}</span>
              <span className="text-[11px] text-zinc-600">{day.count} paz.</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              {view === "day"
                ? `Appuntamenti ${format(new Date(selectedDay), "d MMMM", {
                    locale: it,
                  })}`
                : "Elenco degli appuntamenti"}
            </h2>
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-800">
              <Link
                href="/dashboard"
                className={`rounded-full px-2 py-1 ${
                  view === "week"
                    ? "bg-emerald-700 text-white"
                    : "hover:text-emerald-700"
                }`}
              >
                Settimana
              </Link>
              <Link
                href={`/dashboard?view=day&day=${selectedDay}`}
                className={`rounded-full px-2 py-1 ${
                  view === "day"
                  ? "bg-emerald-700 text-white"
                  : "hover:text-emerald-700"
                }`}
              >
                Giorno
              </Link>
            </div>
            {!isPatient && (
              <DoctorFilter doctors={doctors} selectedDoctor={selectedDoctor} />
            )}
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {listAppointments.length} appuntamenti
          </span>
        </div>
        <div className="mt-4 divide-y divide-zinc-100">
          {listAppointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">{t("empty")}</p>
          ) : (
            listAppointments.map((appt) => (
              <div
                key={appt.id}
                className="mb-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <span aria-hidden="true">
                          {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                          (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                            ? "🦷"
                            : "❤️"}
                        </span>
                        {appt.title}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                        {appt.serviceType}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-800">
                      🧑‍⚕️ Paziente{" "}
                      <Link
                        href={`/pazienti/${appt.patient.id}`}
                        className="font-semibold hover:text-emerald-700"
                      >
                        {appt.patient.lastName} {appt.patient.firstName}
                      </Link>{" "}
                      sarà visitato da{" "}
                      <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                      {appt.doctor?.specialty ? `(${appt.doctor.specialty})` : ""} il{" "}
                      {new Intl.DateTimeFormat("it-IT", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }).format(appt.startsAt)}{" "}
                      alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                    </p>
                    <p className="text-sm text-zinc-800">
                      🕒 Il servizio dovrebbe terminare entro{" "}
                      {new Intl.DateTimeFormat("it-IT", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }).format(appt.endsAt)}{" "}
                      alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.endsAt)}.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                    >
                      {statusLabels[appt.status].toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-zinc-600">
                      {format(appt.startsAt, "d MMM", { locale: it })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
