import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { DEFAULT_WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_NAME } from "@/lib/whatsapp-template";
import {
  adjustAppointmentEndsAt,
  isAppointmentStatus,
  isSameAgendaAppointmentSlot,
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

export async function hasDoctorConflict(params: {
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

export async function updateAppointmentStatusAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
  const status = formData.get("status") as AppointmentStatus;
  const returnToRaw = formData.get("returnTo");
  const returnTo =
    typeof returnToRaw === "string" && returnToRaw.startsWith("/agenda/appuntamenti")
      ? returnToRaw
      : "/agenda/appuntamenti";

  if (!appointmentId || !status || !Object.keys(AppointmentStatus).includes(status)) {
    throw new Error("Dati aggiornamento non validi");
  }

  const current = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { status: true },
  });
  if (!current) throw new Error("Appuntamento non trovato");
  if (current.status === AppointmentStatus.COMPLETED && user.role !== Role.ADMIN) {
    throw new Error("Solo l'admin può modificare appuntamenti completati");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  await logAudit(user, {
    action: "appointment.status_updated",
    entity: "Appointment",
    entityId: appointmentId,
    metadata: { status },
  });

  revalidatePath("/agenda/appuntamenti");
  redirect(returnTo);
}

export async function updateAppointmentAction(formData: FormData) {
  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const appointmentId = formData.get("appointmentId") as string;
    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || "Richiamo";
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_APPOINTMENT_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    const patientId = formData.get("patientId") as string;
    const doctorId = (formData.get("doctorId") as string) || null;
    const status = formData.get("status") as AppointmentStatus;

    if (!appointmentId || !title || !serviceType || !startsAt || !endsAt || !patientId) {
      throw new Error("Compila titolo, servizio, orari e paziente.");
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt = adjustAppointmentEndsAt(startsAtDate, endsAtDate);

    if (!isAppointmentStatus(status)) {
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

    const isSameSlot = isSameAgendaAppointmentSlot(current, {
      doctorId,
      startsAt: startsAtDate,
      endsAt: adjustedEndsAt,
    });

    if (!isSameSlot) {
      const conflict = await hasDoctorConflict({
        doctorId,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        excludeId: appointmentId,
      });
      if (conflict) {
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
      },
    });

    await logAudit(user, {
      action: "appointment.updated",
      entity: "Appointment",
      entityId: appointmentId,
      metadata: { patientId, doctorId, status },
    });

    revalidatePath("/agenda/appuntamenti");
    redirect("/agenda/appuntamenti?success=Appuntamento aggiornato con successo.");
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante l'aggiornamento dell'appuntamento.";
    console.error("Update appointment failed:", err);
    redirect(`/agenda/appuntamenti?error=${encodeURIComponent(message)}`);
  }
}

export async function deleteAppointmentAction(formData: FormData) {
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

  revalidatePath("/agenda/appuntamenti");
  redirect("/agenda/appuntamenti");
}

type AgendaQueryInput = {
  statusValue?: string;
  dateValue?: string;
  searchValue: string;
  pageParam?: string;
};

type AgendaAppointment = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true; phone: true } };
    doctor: { select: { fullName: true; specialty: true } };
  };
}>;

export async function getAgendaPageData({ statusValue, dateValue, searchValue, pageParam }: AgendaQueryInput) {
  const statusFilter =
    statusValue && isAppointmentStatus(statusValue)
      ? (statusValue as AppointmentStatus)
      : undefined;

  const searchQuery = normalizeAgendaSearchValue(searchValue);
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

  const where: Prisma.AppointmentWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateRange ? { startsAt: dateRange } : {}),
    ...(searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { serviceType: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            {
              patient: {
                OR: [
                  { firstName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                  { lastName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            },
            {
              doctor: {
                OR: [
                  { fullName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                  { specialty: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [appointments, patients, doctors, services, totalCount, whatsappTemplate, availabilityWindowsRaw, practiceClosuresRaw, practiceWeeklyClosuresRaw] =
    await Promise.all([
      prisma.appointment.findMany({
        orderBy: { startsAt: "asc" },
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
    ]);

  const serviceOptions = Array.from(new Set([...services.map((s) => s.name), ...FALLBACK_APPOINTMENT_SERVICES]).values());

  return {
    appointments,
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
    page,
    skip,
    totalPages: Math.max(1, Math.ceil(totalCount / AGENDA_PAGE_SIZE)),
    showingFrom: totalCount === 0 ? 0 : skip + 1,
    showingTo: skip + appointments.length,
  };
}
