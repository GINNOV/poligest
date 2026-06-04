import { AppointmentStatus, Prisma } from "@prisma/client";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_NAME } from "@/lib/whatsapp-template";
import {
  isAppointmentStatus,
  normalizeAgendaSearchValue,
  parseAgendaDateRange,
  parseAgendaPageNumber,
} from "@/lib/appointments/agenda-domain";

export const AGENDA_PAGE_SIZE = 20;
export const FALLBACK_APPOINTMENT_SERVICES = ["Visita di controllo", "Igiene", "Otturazione", "Chirurgia"];

type ServiceRow = { name: string };
type AvailabilityWindowRow = {
  doctorId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};
type PracticeClosureRow = {
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  type?: string | null;
};
type PracticeWeeklyClosureRow = {
  dayOfWeek: number;
  title: string | null;
};

export function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function hasDoctorConflict() {
  // Allow concurrent appointments for the same doctor
  return false;
}

type AgendaQueryInput = {
  statusValue?: string;
  dateValue?: string;
  doctorName?: string;
  searchValue: string;
  pageParam?: string;
  letter?: string;
  chronological?: boolean;
};

type AgendaAppointment = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true; phone: true } };
    doctor: { select: { fullName: true; specialty: true } };
  };
}> & { reminderSent?: boolean; reminderSendCount?: number };

const APPOINTMENT_WHATSAPP_REMINDER_ACTION = "appointment.whatsapp_reminder_clicked";

export async function getAppointmentWhatsappReminderCounts(appointmentIds: string[]) {
  const uniqueIds = Array.from(new Set(appointmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, number>();

  const rows = await prisma.auditLog.groupBy({
    by: ["entityId"],
    where: {
      action: APPOINTMENT_WHATSAPP_REMINDER_ACTION,
      entity: "Appointment",
      entityId: { in: uniqueIds },
    },
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.entityId) {
      counts.set(row.entityId, row._count._all);
    }
  }
  return counts;
}

export async function getAgendaPageData({
  statusValue,
  dateValue,
  doctorName,
  searchValue,
  pageParam,
  letter,
  chronological = false,
}: AgendaQueryInput) {
  const statusFilter =
    statusValue && isAppointmentStatus(statusValue)
      ? (statusValue as AppointmentStatus)
      : undefined;

  const doctorQuery = normalizeAgendaSearchValue(doctorName);
  const searchQuery = normalizeAgendaSearchValue(searchValue);
  const searchTokens = searchQuery ? searchQuery.split(/\s+/).filter(Boolean) : [];
  const dateRange = parseAgendaDateRange(dateValue);
  const page = parseAgendaPageNumber(pageParam);
  const skip = (page - 1) * AGENDA_PAGE_SIZE;

  const serviceClient = getOptionalPrismaModel<{
    findMany?: (args: { orderBy: { name: "asc" } }) => Promise<ServiceRow[]>;
  }>("service");
  const availabilityClient = getOptionalPrismaModel<{
    findMany?: (args: Record<string, never>) => Promise<AvailabilityWindowRow[]>;
  }>("doctorAvailabilityWindow");
  const closureClient = getOptionalPrismaModel<{
    findMany?: (args: { orderBy: Array<{ startsAt: "desc" }> }) => Promise<PracticeClosureRow[]>;
  }>("practiceClosure");
  const weeklyClosureClient = getOptionalPrismaModel<{
    findMany?: (args: { where: { isActive: true }; orderBy: Array<{ dayOfWeek: "asc" }> }) => Promise<PracticeWeeklyClosureRow[]>;
  }>("practiceWeeklyClosure");

  const baseWhere: Prisma.AppointmentWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateRange ? { startsAt: dateRange } : {}),
    ...(doctorQuery
      ? {
          AND: [
            {
              doctor: {
                fullName: { contains: doctorQuery, mode: Prisma.QueryMode.insensitive },
              },
            },
          ],
        }
      : {}),
    ...(searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { serviceType: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            {
              AND: searchTokens.map((token) => ({
                patient: {
                  OR: [
                    { firstName: { contains: token, mode: Prisma.QueryMode.insensitive } },
                    { lastName: { contains: token, mode: Prisma.QueryMode.insensitive } },
                  ],
                },
              })),
            },
            {
              AND: searchTokens.map((token) => ({
                doctor: {
                  OR: [
                    { fullName: { contains: token, mode: Prisma.QueryMode.insensitive } },
                    { specialty: { contains: token, mode: Prisma.QueryMode.insensitive } },
                  ],
                },
              })),
            },
          ],
        }
      : {}),
  };

  const where: Prisma.AppointmentWhereInput = {
    ...baseWhere,
    ...(letter ? { patient: { lastName: { startsWith: letter, mode: Prisma.QueryMode.insensitive } } } : {}),
  };

  const [appointments, patients, doctors, services, totalCount, whatsappTemplate, availabilityWindowsRaw, practiceClosuresRaw, practiceWeeklyClosuresRaw, appointmentsForLetters] =
    await Promise.all([
      prisma.appointment.findMany({
        orderBy: chronological
          ? [
              { startsAt: "asc" },
              { patient: { lastName: "asc" } },
              { patient: { firstName: "asc" } },
            ]
          : [
              { startsAt: "desc" },
              { patient: { lastName: "asc" } },
              { patient: { firstName: "asc" } },
            ],
        take: AGENDA_PAGE_SIZE,
        skip,
        include: {
          patient: { select: { firstName: true, lastName: true, phone: true } },
          doctor: { select: { fullName: true, specialty: true } },
        },
        where,
      }) as Promise<AgendaAppointment[]>,
      prisma.patient.findMany({
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
      serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
      prisma.appointment.count({ where }),
      prisma.smsTemplate.findUnique({
        where: { name: WHATSAPP_TEMPLATE_NAME },
      }),
      availabilityClient?.findMany ? availabilityClient.findMany({}) : Promise.resolve([]),
      closureClient?.findMany
        ? closureClient.findMany({ orderBy: [{ startsAt: "desc" }] })
        : Promise.resolve([]),
      weeklyClosureClient?.findMany
        ? weeklyClosureClient.findMany({ where: { isActive: true }, orderBy: [{ dayOfWeek: "asc" }] })
        : Promise.resolve([]),
      // Fetch letters based on the base filters (status, date, search) but NOT the letter itself
      prisma.appointment.findMany({
        where: baseWhere,
        select: { patient: { select: { lastName: true } } },
      }),
    ]);

  const availableLetters = Array.from(
    new Set(
      appointmentsForLetters
        .map((a) => a.patient.lastName?.trim().charAt(0).toUpperCase())
        .filter((l): l is string => Boolean(l))
    )
  ).sort();

  const reminderCounts = await getAppointmentWhatsappReminderCounts(appointments.map((appt) => appt.id));

  const appointmentsWithStatus = appointments
    .sort((a, b) => {
      const dateA = a.startsAt.toISOString().split("T")[0];
      const dateB = b.startsAt.toISOString().split("T")[0];

      if (dateA !== dateB) {
        return chronological ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }

      if (chronological) {
        const timeCompare = a.startsAt.getTime() - b.startsAt.getTime();
        if (timeCompare !== 0) return timeCompare;
      }

      // Same day, sort by name
      const nameA = `${a.patient.lastName} ${a.patient.firstName}`.toLowerCase();
      const nameB = `${b.patient.lastName} ${b.patient.firstName}`.toLowerCase();

      return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
    })
    .map((appt) => ({
      ...appt,
      reminderSent: (reminderCounts.get(appt.id) ?? 0) > 0,
      reminderSendCount: reminderCounts.get(appt.id) ?? 0,
    }));

  const serviceOptions = Array.from(new Set([...services.map((s) => s.name), ...FALLBACK_APPOINTMENT_SERVICES]).values());

  return {
    appointments: appointmentsWithStatus,
    patients,
    doctors,
    serviceOptionObjects: serviceOptions.map((name) => ({ id: name, name })),
    whatsappTemplateBody: whatsappTemplate?.body ?? DEFAULT_WHATSAPP_TEMPLATE,
    availabilityWindows: availabilityWindowsRaw.map((row) => ({
      doctorId: row.doctorId,
      dayOfWeek: row.dayOfWeek,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
    })),
    practiceClosures: practiceClosuresRaw.map((row) => ({
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      title: row.title,
      type: row.type ?? undefined,
    })),
    practiceWeeklyClosures: practiceWeeklyClosuresRaw.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      title: row.title,
    })),
    totalCount,
    availableLetters,
    page,
    skip,
    totalPages: Math.max(1, Math.ceil(totalCount / AGENDA_PAGE_SIZE)),
    showingFrom: totalCount === 0 ? 0 : skip + 1,
    showingTo: skip + appointments.length,
  };
}
