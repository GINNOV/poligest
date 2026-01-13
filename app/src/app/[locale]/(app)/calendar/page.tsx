import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { logAudit } from "@/lib/audit";
import { normalizeItalianPhone } from "@/lib/phone";
import { normalizePersonName } from "@/lib/name";
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

function weekdayIso(date: Date) {
  const jsDay = date.getDay(); // 0=Sun ... 6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

function dateStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dateEndExclusive(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function parseDateParam(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const formatLocalInput = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
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

async function hasDoctorConflict(params: {
  doctorId: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  const { doctorId, startsAt, endsAt, excludeId } = params;
  if (!doctorId) return false;

  const conflicts = await prisma.appointment.count({
    where: {
      doctorId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return conflicts > 0;
}

function ensureCalendarReturnTo(value: string | null) {
  if (!value || !value.startsWith("/calendar")) return "/calendar";
  return value;
}

function appendQueryParam(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

async function resolvePatientIdForAppointment(params: {
  selectedPatientId: string;
  newEmail?: string | null;
  newFirstName?: string | null;
  newLastName?: string | null;
  newPhone?: string | null;
}) {
  const { selectedPatientId, newEmail, newFirstName, newLastName, newPhone } = params;
  const normalizedEmail = newEmail?.trim().toLowerCase() || null;
  const normalizedFirstName = normalizePersonName(newFirstName ?? "");
  const normalizedLastName = normalizePersonName(newLastName ?? "");

  if (selectedPatientId === "new") {
    if (normalizedEmail) {
      const existing = await prisma.patient.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    const patient = await prisma.patient.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: newPhone ?? null,
        email: normalizedEmail,
      },
    });
    return patient.id;
  }

  const selected = await prisma.patient.findUnique({
    where: { id: selectedPatientId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!selected) {
    throw new Error("Paziente non trovato.");
  }
  if (selected.email) return selected.id;

  const match = await prisma.patient.findMany({
    where: {
      AND: [
        { firstName: { equals: selected.firstName, mode: "insensitive" } },
        { lastName: { equals: selected.lastName, mode: "insensitive" } },
        { NOT: { email: null } },
        { NOT: { email: "" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 2,
    select: { id: true },
  });

  return match.length === 1 ? match[0].id : selected.id;
}

async function createAppointment(formData: FormData) {
  "use server";

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || "Richiamo";
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    const endsAtRaw = formData.get("endsAt") as string;
    const endsAtDate =
      endsAtRaw && !endsAtRaw.endsWith(":")
        ? new Date(endsAtRaw)
        : startsAt
          ? new Date(new Date(startsAt).getTime() + 60 * 60 * 1000)
          : null;
    const patientIdRaw = formData.get("patientId") as string;
    const doctorId = (formData.get("doctorId") as string) || null;
    const notes = (formData.get("notes") as string)?.trim() || null;
    const newEmail = (formData.get("newEmail") as string | null)?.trim() || null;
    const newFirstName = (formData.get("newFirstName") as string | null)?.trim() || null;
    const newLastName = (formData.get("newLastName") as string | null)?.trim() || null;
    const newPhone = normalizeItalianPhone((formData.get("newPhone") as string | null) ?? null);

    if (!title || !serviceType || !startsAt || !endsAtDate || !patientIdRaw) {
      throw new Error("Compila titolo, servizio, orari e paziente.");
    }

    const startsAtDate = new Date(startsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt =
      endsAtDate <= startsAtDate
        ? new Date(startsAtDate.getTime() + 60 * 60 * 1000)
        : endsAtDate;

    const hasConflict = await hasDoctorConflict({
      doctorId,
      startsAt: startsAtDate,
      endsAt: adjustedEndsAt,
    });
    if (hasConflict) {
      throw new Error(
        "Il medico selezionato ha già un appuntamento in questo intervallo. Scegli un orario diverso."
      );
    }

    if (patientIdRaw === "new" && (!newFirstName || !newLastName || !newPhone)) {
      throw new Error("Inserisci nome, cognome e telefono per il nuovo cliente.");
    }

    const patientId = await resolvePatientIdForAppointment({
      selectedPatientId: patientIdRaw,
      newEmail,
      newFirstName,
      newLastName,
      newPhone,
    });

    const appointment = await prisma.appointment.create({
      data: {
        title,
        serviceType,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        patientId,
        doctorId,
        notes,
        status: AppointmentStatus.CONFIRMED,
      },
    });

    await logAudit(user, {
      action: "appointment.created",
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { patientId, doctorId },
    });

    revalidatePath("/calendar");
    revalidatePath("/agenda");
    const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");
    redirect(returnTo);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante la creazione dell'appuntamento.";
    console.error("Create appointment failed:", err);
    const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");
    redirect(appendQueryParam(returnTo, "error", message));
  }
}

async function updateAppointment(formData: FormData) {
  "use server";

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const appointmentId = formData.get("appointmentId") as string;
    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || "Richiamo";
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    const patientId = formData.get("patientId") as string;
    const doctorId = (formData.get("doctorId") as string) || null;
    const status = formData.get("status") as AppointmentStatus;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!appointmentId || !title || !serviceType || !startsAt || !endsAt || !patientId) {
      throw new Error("Compila titolo, servizio, orari e paziente.");
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt =
      endsAtDate <= startsAtDate
        ? new Date(startsAtDate.getTime() + 30 * 60 * 1000)
        : endsAtDate;

    if (!Object.keys(AppointmentStatus).includes(status)) {
      throw new Error("Stato non valido");
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true, startsAt: true, endsAt: true, doctorId: true },
    });
    if (!current) throw new Error("Appuntamento non trovato");
    if (current.status === AppointmentStatus.COMPLETED && user.role !== Role.ADMIN) {
      throw new Error("Solo l'admin può modificare appuntamenti completati");
    }

    const isSameSlot =
      current.doctorId === doctorId &&
      Math.abs(current.startsAt.getTime() - startsAtDate.getTime()) < 1000 &&
      Math.abs(current.endsAt.getTime() - adjustedEndsAt.getTime()) < 1000;

    if (!isSameSlot) {
      const hasConflict = await hasDoctorConflict({
        doctorId,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        excludeId: appointmentId,
      });
      if (hasConflict) {
        throw new Error(
          "Il medico selezionato ha già un appuntamento in questo intervallo. Scegli un orario diverso."
        );
      }
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        title,
        serviceType,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        patientId,
        doctorId,
        status,
        notes,
      },
    });

    await logAudit(user, {
      action: "appointment.updated",
      entity: "Appointment",
      entityId: appointmentId,
      metadata: { patientId, doctorId, status },
    });

    revalidatePath("/calendar");
    revalidatePath("/agenda");
    const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");
    redirect(returnTo);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante l'aggiornamento dell'appuntamento.";
    console.error("Update appointment failed:", err);
    const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");
    redirect(appendQueryParam(returnTo, "error", message));
  }
}

async function deleteAppointment(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const appointmentId = (formData.get("appointmentId") as string) || "";

  if (!appointmentId) {
    throw new Error("Appuntamento mancante");
  }

  await prisma.appointment.delete({ where: { id: appointmentId } });

  await logAudit(user, {
    action: "appointment.deleted",
    entity: "Appointment",
    entityId: appointmentId,
  });

  revalidatePath("/calendar");
  revalidatePath("/agenda");
  const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");
  redirect(returnTo);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "calendar");
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
  const view = viewParam === "week" ? "week" : "month";
  const monthMatch = monthParam?.match(/^(\d{4})-(\d{2})$/);
  let baseMonth = monthMatch
    ? new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1)
    : new Date();
  const weekBase = parseDateParam(weekParam) ?? new Date();
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  if (!monthMatch && view === "week") {
    baseMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  }

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

  const monthStart = startOfMonth(baseMonth);
  const monthEnd = endOfMonth(baseMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const appointmentRangeStart = view === "week" ? weekStart : monthStart;
  const appointmentRangeEnd = view === "week" ? weekEnd : monthEnd;
  const closureRangeStart = view === "week" ? weekStart : calendarStart;
  const closureRangeEnd = view === "week" ? weekEnd : calendarEnd;

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;
  const availabilityClient = prismaModels["doctorAvailabilityWindow"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;
  const closureClient = prismaModels["practiceClosure"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;
  const weeklyClosureClient = prismaModels["practiceWeeklyClosure"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  type ServiceRow = { name: string };

  const [
    appointmentsRaw,
    patients,
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
      select: { id: true, firstName: true, lastName: true, email: true },
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
  const services = servicesRaw as ServiceRow[];
  const windows = availabilityWindowsRaw as AvailabilityWindow[];
  const closures = practiceClosuresRaw as PracticeClosure[];
  const weeklyClosures = practiceWeeklyClosuresRaw as PracticeWeeklyClosure[];
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
    const key = format(appt.startsAt, "yyyy-MM-dd");
    if (!appointmentsByDay.has(key)) {
      appointmentsByDay.set(key, []);
    }
    appointmentsByDay.get(key)?.push(appt);
  });

  const monthLabel = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(baseMonth);
  const prevMonth = format(addMonths(baseMonth, -1), "yyyy-MM");
  const nextMonth = format(addMonths(baseMonth, 1), "yyyy-MM");
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const weekKey = format(weekStart, "yyyy-MM-dd");
  const prevWeekKey = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeekKey = format(addDays(weekStart, 7), "yyyy-MM-dd");
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
    return `/calendar?${nextParams.toString()}`;
  };
  const selectedMonthKey = format(baseMonth, "yyyy-MM");
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
  const returnTo = `/calendar?${returnParams.toString()}`;
  const calendarDays = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
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
      appointments: dayAppointments.map((appt) => ({
        id: appt.id,
        title: appt.title,
        startsAt: formatLocalInput(appt.startsAt),
        endsAt: formatLocalInput(appt.endsAt),
        serviceType: appt.serviceType,
        patientName: `${appt.patient.lastName} ${appt.patient.firstName}`,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        status: appt.status,
        notes: appt.notes ?? null,
      })),
    };
  });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => {
    const key = format(day, "yyyy-MM-dd");
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
      isToday: isToday(day),
      isPracticeClosed,
      availabilityWindows,
      appointments: dayAppointments.map((appt) => ({
        id: appt.id,
        title: appt.title,
        startsAt: formatLocalInput(appt.startsAt),
        endsAt: formatLocalInput(appt.endsAt),
        serviceType: appt.serviceType,
        patientName: `${appt.patient.lastName} ${appt.patient.firstName}`,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        status: appt.status,
        notes: appt.notes ?? null,
      })),
    };
  });

  return (
      <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Aggiungi appuntamenti dei medici
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
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
          <div className="flex items-center gap-2">
            <Link
              href={buildCalendarLink({ view: "month", month: selectedMonthKey })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                view === "month"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700"
              }`}
            >
              Vista mese
            </Link>
            <Link
              href={buildCalendarLink({ view: "week", week: weekKey })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                view === "week"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 text-zinc-600 hover:border-emerald-200 hover:text-emerald-700"
              }`}
            >
              Vista settimana
            </Link>
          </div>
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Nessun medico registrato. Aggiungi un medico per usare il calendario.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 capitalize">
                {view === "month" ? (
                  monthLabel
                ) : (
                  <CalendarWeekPicker
                    label={`${new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(weekStart)} - ${new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(weekEnd)}`}
                    weekKey={weekKey}
                  />
                )}
              </h2>
              {view === "week" && showAllDoctors ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Per vedere gli slot liberi in modo chiaro, seleziona un medico specifico.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
              {view === "month" ? (
                <>
                  <Link
                    href={buildCalendarLink({ view: "month", month: prevMonth })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    ← Mese precedente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "month", month: currentMonthKey })}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Mese corrente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "month", month: nextMonth })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Mese successivo →
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={buildCalendarLink({ view: "week", week: prevWeekKey })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    ← Settimana precedente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "week", week: format(new Date(), "yyyy-MM-dd") })}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Settimana corrente
                  </Link>
                  <Link
                    href={buildCalendarLink({ view: "week", week: nextWeekKey })}
                    className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Settimana successiva →
                  </Link>
                </>
              )}
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {appointments.length} appuntamenti
              </span>
            </div>
          </div>

          {view === "month" ? (
            <CalendarMonthView
              days={calendarDays}
              patients={patients}
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
            />
          ) : (
            <CalendarWeekView
              weekDays={weekDays}
              patients={patients}
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
            />
          )}
        </div>
      )}
    </div>
  );
}
