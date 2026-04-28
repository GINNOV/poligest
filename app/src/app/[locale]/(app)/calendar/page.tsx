import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { logAudit } from "@/lib/audit";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { normalizeItalianPhone } from "@/lib/phone";
import { normalizePersonName } from "@/lib/name";
import {
  appendCalendarQueryParam,
  dateEndExclusive,
  dateStart,
  ensureCalendarReturnTo,
  formatCalendarLocalInput,
  parseCalendarDateParam,
  weekdayIso,
} from "@/lib/calendar/domain";
import { AppointmentStatus, Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDoctorFilter } from "@/components/calendar-doctor-filter";
import { CalendarMonthView } from "@/components/calendar-month-view";
import { CalendarPreferencesSync } from "@/components/calendar-preferences-sync";
import { CalendarWeekView } from "@/components/calendar-week-view";
import { CalendarWeekPicker } from "@/components/calendar-week-picker";
import { CalendarSearch } from "@/components/calendar-search";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import * as TZ from "@/lib/user-display-time-zone";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "./actions";

export const metadata: Metadata = {
  title: "AGENDA",
};

const FALLBACK_SERVICES = ["Visita di controllo", "Igiene", "Otturazione", "Chirurgia"];

type CalendarAppointmentRecord = {
  id: string;
  title: string;
  serviceType: string;
  startsAt: Date;
  endsAt: Date;
  patientId: string;
  doctorId: string | null;
  status: AppointmentStatus;
  notes: string | null;
  patient: { firstName: string; lastName: string };
};

type AvailabilityWindow = {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  color: string | null;
};

type PracticeClosure = {
  id: string;
  type: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
};

type PracticeWeeklyClosure = {
  id: string;
  dayOfWeek: number;
  title: string | null;
  isActive: boolean;
};

type ClientPracticeClosure = {
  startsAt: string;
  endsAt: string;
  title?: string | null;
  type?: string;
};

type ClientWeeklyClosure = {
  dayOfWeek: number;
  title?: string | null;
};

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "calendar");
  const displayTimeZone = await getUserDisplayTimeZone();
  const params = await searchParams;

  const monthParam =
    typeof params.month === "string"
      ? params.month
      : Array.isArray(params.month)
        ? params.month[0]
        : undefined;
  const weekParam =
    typeof params.week === "string"
      ? params.week
      : Array.isArray(params.week)
        ? params.week[0]
        : undefined;
  const viewParam =
    typeof params.view === "string"
      ? params.view
      : Array.isArray(params.view)
        ? params.view[0]
        : undefined;
  const initialAppointmentId =
    typeof params.edit === "string"
      ? params.edit
      : Array.isArray(params.edit)
        ? params.edit[0]
        : undefined;

  const searchQueryRaw =
    typeof params.q === "string"
      ? params.q
      : Array.isArray(params.q)
        ? params.q[0]
        : undefined;

  // Clear search if we are targeting a specific appointment to ensure it's visible
  const searchQuery = initialAppointmentId ? undefined : searchQueryRaw;

  const view = viewParam === "week" ? "week" : "month";

  const weekBase = (() => {
    if (typeof weekParam === "string") {
      const d = TZ.parseDateAtMidnightInTimeZone(weekParam, displayTimeZone);
      if (!isNaN(d.getTime())) return d;
    }
    return TZ.getNowInTimeZone(displayTimeZone);
  })();
  const weekIntervalDays = TZ.getWeekDaysInTimeZone(weekBase, displayTimeZone);
  const weekStart = weekIntervalDays[0];
  const weekEnd = new Date(weekIntervalDays[6].getTime() + 24 * 60 * 60 * 1000 - 1);

  const monthMatch = monthParam?.match(/^(\d{4})-(\d{2})$/);
  let baseMonth = monthMatch
    ? TZ.parseDateAtMidnightInTimeZone(`${monthParam}-01`, displayTimeZone)
    : new Date();
  
  if (!monthMatch && view === "week") {
    baseMonth = weekStart;
  }

  const monthRange = TZ.getMonthRangeInTimeZone(baseMonth, displayTimeZone);
  const monthStart = monthRange.start;
  const monthEnd = monthRange.end;

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const doctors = await prisma.doctor.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, specialty: true, color: true },
  });

  const doctorParam =
    typeof params.doctor === "string"
      ? params.doctor
      : Array.isArray(params.doctor)
        ? params.doctor[0]
        : undefined;

  const showAllDoctors = doctorParam === "all";
  const selectedDoctorId = showAllDoctors
    ? undefined
    : doctors.find((doc) => doc.id === doctorParam)?.id ?? doctors[0]?.id;

  const appointmentRangeStart = view === "week" ? weekStart : monthStart;
  const appointmentRangeEnd = view === "week" ? weekEnd : monthEnd;
  const closureRangeStart = view === "week" ? weekStart : calendarStart;
  const closureRangeEnd = view === "week" ? weekEnd : calendarEnd;

  const serviceClient = getOptionalPrismaModel<{
    findMany?: (args: { orderBy: { name: "asc" } }) => Promise<ServiceRow[]>;
  }>("service");
  const availabilityClient = getOptionalPrismaModel<{
    findMany?: (args: { where: { doctorId: { in: string[] } } }) => Promise<AvailabilityWindow[]>;
  }>("doctorAvailabilityWindow");
  const closureClient = getOptionalPrismaModel<{
    findMany?: (args: { where: { startsAt: { lt: Date }; endsAt: { gt: Date } } }) => Promise<PracticeClosure[]>;
  }>("practiceClosure");
  const weeklyClosureClient = getOptionalPrismaModel<{
    findMany?: (args: { where: { isActive: true }; orderBy: Array<{ dayOfWeek: "asc" }> }) => Promise<PracticeWeeklyClosure[]>;
  }>("practiceWeeklyClosure");

  type ServiceRow = { name: string };

  const [
    appointmentsRaw,
    patientsRaw,
    servicesRaw,
    availabilityWindowsRaw,
    practiceClosuresRaw,
    practiceWeeklyClosuresRaw,
  ] =
    await Promise.all([
    showAllDoctors
      ? prisma.appointment.findMany({
          where: {
            startsAt: { gte: appointmentRangeStart, lte: appointmentRangeEnd },
          },
          orderBy: { startsAt: "asc" },
          select: {
            id: true,
            title: true,
            serviceType: true,
            startsAt: true,
            endsAt: true,
            patientId: true,
            doctorId: true,
            status: true,
            notes: true,
            patient: { select: { firstName: true, lastName: true } },
          },
        })
      : selectedDoctorId
        ? prisma.appointment.findMany({
            where: {
              doctorId: selectedDoctorId,
              startsAt: { gte: appointmentRangeStart, lte: appointmentRangeEnd },
            },
            orderBy: { startsAt: "asc" },
            select: {
              id: true,
              title: true,
              serviceType: true,
              startsAt: true,
              endsAt: true,
              patientId: true,
              doctorId: true,
              status: true,
              notes: true,
              patient: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([] as CalendarAppointmentRecord[]),
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, notes: true },
    }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    availabilityClient?.findMany && doctors.length
      ? availabilityClient.findMany({
          where: {
            doctorId: { in: doctors.map((doctor) => doctor.id) },
          },
        })
      : Promise.resolve([]),
    closureClient?.findMany
      ? closureClient.findMany({
          where: {
            startsAt: { lt: closureRangeEnd },
            endsAt: { gt: closureRangeStart },
          },
        })
      : Promise.resolve([]),
    weeklyClosureClient?.findMany
      ? weeklyClosureClient.findMany({
          where: { isActive: true },
          orderBy: [{ dayOfWeek: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const appointments = appointmentsRaw as CalendarAppointmentRecord[];
  const mappedPatients = patientsRaw.map((p) => {
    const { parsedTaxId } = parsePatientStructuredNotes(p.notes);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      taxId: parsedTaxId,
    };
  });
  const services = servicesRaw;
  const windows = availabilityWindowsRaw;
  const closures = practiceClosuresRaw;
  const weeklyClosures = practiceWeeklyClosuresRaw;
  const clientClosures: ClientPracticeClosure[] = closures.map((closure) => ({
    startsAt: closure.startsAt.toISOString(),
    endsAt: closure.endsAt.toISOString(),
    title: closure.title,
    type: closure.type,
  }));
  const clientWeeklyClosures: ClientWeeklyClosure[] = weeklyClosures.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    title: row.title,
  }));

  const doctorColorById = new Map<string, string | null>();
  doctors.forEach((doctor) => doctorColorById.set(doctor.id, doctor.color ?? null));

  const windowsByWeekday = new Map<number, AvailabilityWindow[]>();
  windows.forEach((win) => {
    const list = windowsByWeekday.get(win.dayOfWeek) ?? [];
    list.push(win);
    windowsByWeekday.set(win.dayOfWeek, list);
  });

  const appointmentsByDay = new Map<string, CalendarAppointmentRecord[]>();
  appointments.forEach((appt) => {
    const key = TZ.formatDateInputValueInTimeZone(appt.startsAt, displayTimeZone);
    if (!appointmentsByDay.has(key)) {
      appointmentsByDay.set(key, []);
    }
    appointmentsByDay.get(key)?.push(appt);
  });

  const monthLabel = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(baseMonth);
  const currentMonthKey = TZ.formatDateInputValueInTimeZone(new Date(), displayTimeZone).slice(0, 7);
  const selectedMonthKey = TZ.formatDateInputValueInTimeZone(baseMonth, displayTimeZone).slice(0, 7);
  const prevMonth = format(addMonths(baseMonth, -1), "yyyy-MM");
  const nextMonth = format(addMonths(baseMonth, 1), "yyyy-MM");
  
  const weekKey = TZ.formatDateInputValueInTimeZone(weekStart, displayTimeZone);
  const prevWeekKey = TZ.formatDateInputValueInTimeZone(addDays(weekStart, -7), displayTimeZone);
  const nextWeekKey = TZ.formatDateInputValueInTimeZone(addDays(weekStart, 7), displayTimeZone);
  const doctorOptionList = doctors.map((doc) => ({
    id: doc.id,
    label: doc.fullName,
  }));
  const serviceOptions = Array.from(
    new Set([
      ...services.map((service) => service.name),
      ...FALLBACK_SERVICES,
    ]).values()
  );
  const serviceOptionObjects = serviceOptions.map((name) => ({ id: name, name }));

  const buildCalendarLink = (params: { view?: "month" | "week"; month?: string; week?: string }) => {
    const nextParams = new URLSearchParams();
    const nextView = params.view ?? view;
    nextParams.set("view", nextView);
    if (showAllDoctors) {
      nextParams.set("doctor", "all");
    } else if (selectedDoctorId) {
      nextParams.set("doctor", selectedDoctorId);
    }
    if (params.month) {
      nextParams.set("month", params.month);
    }
    if (params.week) {
      nextParams.set("week", params.week);
    }
    if (searchQueryRaw) {
      nextParams.set("q", searchQueryRaw);
    }
    return `/calendar?${nextParams.toString()}`;
  };
  const returnParams = new URLSearchParams();
  if (showAllDoctors) {
    returnParams.set("doctor", "all");
  } else if (selectedDoctorId) {
    returnParams.set("doctor", selectedDoctorId);
  }
  returnParams.set("view", view);
  if (view === "week") {
    returnParams.set("week", weekKey);
  } else {
    returnParams.set("month", selectedMonthKey);
  }
  if (searchQueryRaw) {
    returnParams.set("q", searchQueryRaw);
  }
  const returnTo = `/calendar?${returnParams.toString()}`;
  const calendarDays = days.map((day) => {
    const key = TZ.formatDateInputValueInTimeZone(day, displayTimeZone);
    const dayAppointments = appointmentsByDay.get(key) ?? [];
    const dayWindows = showAllDoctors
      ? (windowsByWeekday.get(weekdayIso(day)) ?? [])
      : selectedDoctorId
        ? (windowsByWeekday.get(weekdayIso(day)) ?? []).filter((win) => win.doctorId === selectedDoctorId)
        : [];
    const dayStart = dateStart(day);
    const dayEnd = dateEndExclusive(day);
    const isClosedByRange = closures.some(
      (closure) => new Date(closure.startsAt) < dayEnd && new Date(closure.endsAt) > dayStart
    );
    const isClosedWeekly = weeklyClosures.some(
      (row) => row.isActive && row.dayOfWeek === weekdayIso(day)
    );
    const isPracticeClosed = isClosedByRange || isClosedWeekly;
    const availabilityColors = dayWindows
      .map((win) => win.color ?? doctorColorById.get(win.doctorId) ?? "#10b981")
      .filter((color): color is string => Boolean(color));
    return {
      date: key,
      label: format(day, "d", { locale: it }),
      inMonth: isSameMonth(day, monthStart),
      isToday: isToday(day),
      availabilityColors,
      isPracticeClosed,
      appointments: dayAppointments.map((appt) => {
        const startsAtLocal = formatCalendarLocalInput(appt.startsAt, displayTimeZone);
        const endsAtLocal = formatCalendarLocalInput(appt.endsAt, displayTimeZone);
        const tStart = startsAtLocal.split("T")[1];
        const tEnd = endsAtLocal.split("T")[1];

        const [hStart, mStart] = tStart.split(":").map(Number);
        const [hEnd, mEnd] = tEnd.split(":").map(Number);

        return {
          id: appt.id,
          title: appt.title,
          startsAt: startsAtLocal,
          endsAt: endsAtLocal,
          hStart,
          mStart,
          hEnd,
          mEnd,
          serviceType: appt.serviceType,
          patientName: `${appt.patient.lastName} ${appt.patient.firstName}`,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          status: appt.status,
          notes: appt.notes ?? null,
        };
      }),
    };
  });

  const weekDays = weekIntervalDays.map((day) => {
    const key = TZ.formatDateInputValueInTimeZone(day, displayTimeZone);
    const dayAppointments = appointmentsByDay.get(key) ?? [];
    const dayWindows = showAllDoctors
      ? (windowsByWeekday.get(weekdayIso(day)) ?? [])
      : selectedDoctorId
        ? (windowsByWeekday.get(weekdayIso(day)) ?? []).filter((win) => win.doctorId === selectedDoctorId)
        : [];
    const dayStart = dateStart(day);
    const dayEnd = dateEndExclusive(day);
    const isClosedByRange = closures.some(
      (closure) => new Date(closure.startsAt) < dayEnd && new Date(closure.endsAt) > dayStart
    );
    const isClosedWeekly = weeklyClosures.some(
      (row) => row.isActive && row.dayOfWeek === weekdayIso(day)
    );
    const isPracticeClosed = isClosedByRange || isClosedWeekly;
    const availabilityWindows = dayWindows.map((win) => ({
      startMinute: win.startMinute,
      endMinute: win.endMinute,
      color: win.color ?? doctorColorById.get(win.doctorId) ?? "#10b981",
      doctorId: win.doctorId,
    }));
    return {
      date: key,
      label: TZ.formatDateInDisplayTimeZone(day, { weekday: "short", day: "numeric" }, displayTimeZone),
      isToday: isToday(day),
      isPracticeClosed,
      availabilityWindows,
      appointments: dayAppointments.map((appt) => {
        const startsAtLocal = formatCalendarLocalInput(appt.startsAt, displayTimeZone);
        const endsAtLocal = formatCalendarLocalInput(appt.endsAt, displayTimeZone);
        const tStart = startsAtLocal.split("T")[1];
        const tEnd = endsAtLocal.split("T")[1];

        const [hStart, mStart] = tStart.split(":").map(Number);
        const [hEnd, mEnd] = tEnd.split(":").map(Number);

        return {
          id: appt.id,
          title: appt.title,
          startsAt: startsAtLocal,
          endsAt: endsAtLocal,
          hStart,
          mStart,
          hEnd,
          mEnd,
          serviceType: appt.serviceType,
          patientName: `${appt.patient.lastName} ${appt.patient.firstName}`,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          status: appt.status,
          notes: appt.notes ?? null,
        };
      }),
    };
  });

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {selectedDoctorId && !showAllDoctors 
              ? `Calendario di ${doctors.find(d => d.id === selectedDoctorId)?.fullName}`
              : "Calendario medici"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Seleziona un medico o tutto lo staff per vedere la pianificazione del periodo selezionato.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <CalendarPreferencesSync doctorIds={doctors.map((doctor) => doctor.id)} />
          <CalendarDoctorFilter
            doctors={doctorOptionList}
            selectedDoctorId={selectedDoctorId}
            showAll={showAllDoctors}
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CalendarSearch />
            <div className="flex items-center gap-2">
              <Link
                href={buildCalendarLink({ view: "month", month: selectedMonthKey })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  view === "month"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                    : "border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                }`}
              >
                Vista mese
              </Link>
              <Link
                href={buildCalendarLink({ view: "week", week: weekKey })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  view === "week"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                    : "border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                }`}
              >
                Vista settimana
              </Link>
            </div>
          </div>
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Nessun medico registrato. Aggiungi un medico per usare il calendario.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 capitalize">
                {view === "month" ? (
                  monthLabel
                ) : (
                  <CalendarWeekPicker
                    label={`${TZ.formatDateInDisplayTimeZone(weekStart, { day: "numeric", month: "short" }, displayTimeZone)} - ${TZ.formatDateInDisplayTimeZone(weekEnd, { day: "numeric", month: "short", year: "numeric" }, displayTimeZone)}`}
                    weekKey={weekKey}
                  />
                )}
              </h2>
              {view === "week" && showAllDoctors ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Per vedere gli slot liberi in modo chiaro, seleziona un medico specifico.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {view === "month" ? (
                <>
                  <Link
                    href={buildCalendarLink({ view: "month", month: prevMonth })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                  >
                    ← Mese precedente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "month", month: currentMonthKey })}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                  >
                    Mese corrente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "month", month: nextMonth })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                  >
                    Mese successivo →
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={buildCalendarLink({ view: "week", week: prevWeekKey })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                  >
                    ← Settimana precedente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "week", week: TZ.formatDateInputValueInTimeZone(new Date(), displayTimeZone) })}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                  >
                    Settimana corrente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "week", week: nextWeekKey })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:hover:border-emerald-900/40 dark:hover:text-emerald-300"
                  >
                    Settimana successiva →
                  </Link>
                </>
              )}
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {appointments.length} appuntamenti
              </span>
            </div>
          </div>

          {view === "month" ? (
            <CalendarMonthView
              days={calendarDays}
              patients={mappedPatients}
              doctors={doctors}
              serviceOptions={serviceOptions}
              services={serviceOptionObjects}
              availabilityWindows={windows.map((win) => ({
                doctorId: win.doctorId,
                dayOfWeek: win.dayOfWeek,
                startMinute: win.startMinute,
                endMinute: win.endMinute,
              }))}
              practiceClosures={clientClosures}
              practiceWeeklyClosures={clientWeeklyClosures}
              action={createAppointment}
              updateAction={updateAppointment}
              deleteAction={deleteAppointment}
              selectedDoctorId={selectedDoctorId}
              returnTo={returnTo}
              searchQuery={searchQuery}
              initialAppointmentId={initialAppointmentId}
            />
          ) : (
            <CalendarWeekView
              weekDays={weekDays}
              patients={mappedPatients}
              doctors={doctors}
              serviceOptions={serviceOptions}
              services={serviceOptionObjects}
              availabilityWindows={windows.map((win) => ({
                doctorId: win.doctorId,
                dayOfWeek: win.dayOfWeek,
                startMinute: win.startMinute,
                endMinute: win.endMinute,
              }))}
              practiceClosures={clientClosures}
              practiceWeeklyClosures={clientWeeklyClosures}
              action={createAppointment}
              updateAction={updateAppointment}
              deleteAction={deleteAppointment}
              selectedDoctorId={selectedDoctorId}
              returnTo={returnTo}
              searchQuery={searchQuery}
              initialAppointmentId={initialAppointmentId}
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
