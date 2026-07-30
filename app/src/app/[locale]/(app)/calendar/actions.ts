"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizeItalianPhone } from "@/lib/phone";
import { normalizePersonName } from "@/lib/name";
import { findExistingPatientForCreate } from "@/lib/patients/find-existing-patient";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { parseDateTimeLocalInTimeZone } from "@/lib/time-zone";
import { resolveUserDisplayTimeZone } from "@/lib/user-display-time-zone";
import {
  appendCalendarQueryParam,
  ensureCalendarReturnTo,
} from "@/lib/calendar/domain";
import { parseDoctorTimeOffDateRange } from "@/lib/doctor-time-off";
import { DEFAULT_APPOINTMENT_TITLE } from "@/lib/client-enums";

const FALLBACK_SERVICES = ["Visita di controllo", "Igiene", "Otturazione", "Chirurgia"];

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function hasDoctorConflict() {
  // Allow concurrent appointments for the same doctor
  return false;
}

function getCalendarFormTimeZone(formData: FormData) {
  const submitted = formData.get("timeZone");
  return resolveUserDisplayTimeZone(
    typeof submitted === "string" ? submitted : null,
  );
}

async function resolvePatientIdForAppointment(params: {
  selectedPatientId: string;
  newEmail?: string | null;
  newFirstName?: string | null;
  newLastName?: string | null;
  newPhone?: string | null;
  actor: { id: string; role: Role };
}) {
  const { selectedPatientId, newEmail, newFirstName, newLastName, newPhone, actor } = params;
  const normalizedEmail = newEmail?.trim().toLowerCase() || null;
  const normalizedFirstName = normalizePersonName(newFirstName ?? "");
  const normalizedLastName = normalizePersonName(newLastName ?? "");
  const normalizedPhone = normalizeItalianPhone(newPhone);

  if (selectedPatientId === "new") {
    // Reuse an existing scheda when strong identity signals match (email/phone/name).
    const existingMatch = await findExistingPatientForCreate({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      phone: normalizedPhone,
    });
    if (existingMatch) {
      return existingMatch.patientId;
    }

    const patient = await prisma.patient.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone,
        email: normalizedEmail,
      },
    });

    await logAudit(actor, {
      action: "patient.created",
      entity: "Patient",
      entityId: patient.id,
      metadata: {
        source: "appointment",
        patientName: `${normalizedLastName} ${normalizedFirstName}`.trim(),
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

export async function createAppointment(formData: FormData) {
  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const timeZone = getCalendarFormTimeZone(formData);

    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || DEFAULT_APPOINTMENT_TITLE;
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    const endsAtRaw = formData.get("endsAt") as string;
    const endsAtDate =
      endsAtRaw && !endsAtRaw.endsWith(":")
        ? parseDateTimeLocalInTimeZone(endsAtRaw, timeZone)
        : startsAt
          ? (() => {
              const startDate = parseDateTimeLocalInTimeZone(startsAt, timeZone);
              return startDate ? new Date(startDate.getTime() + 60 * 60 * 1000) : null;
            })()
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

    const startsAtDate = parseDateTimeLocalInTimeZone(startsAt, timeZone);
    if (!startsAtDate || Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt =
      endsAtDate <= startsAtDate
        ? new Date(startsAtDate.getTime() + 60 * 60 * 1000)
        : endsAtDate;

    const hasConflict = await hasDoctorConflict();
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
      actor: user,
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
    redirect(appendCalendarQueryParam(returnTo, "error", message));
  }
}

export async function updateAppointment(formData: FormData) {
  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const timeZone = getCalendarFormTimeZone(formData);
    const appointmentId = formData.get("appointmentId") as string;
    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || DEFAULT_APPOINTMENT_TITLE;
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

    const startsAtDate = parseDateTimeLocalInTimeZone(startsAt, timeZone);
    const endsAtDate = parseDateTimeLocalInTimeZone(endsAt, timeZone);
    if (
      !startsAtDate ||
      !endsAtDate ||
      Number.isNaN(startsAtDate.getTime()) ||
      Number.isNaN(endsAtDate.getTime())
    ) {
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
      const hasConflict = await hasDoctorConflict();
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
    redirect(appendCalendarQueryParam(returnTo, "error", message));
  }
}

export async function deleteAppointment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const appointmentId = (formData.get("appointmentId") as string) || "";

  if (!appointmentId) {
    throw new Error("Appuntamento mancante");
  }

  await prisma.$transaction([
    prisma.appointmentReminder.deleteMany({ where: { appointmentId } }),
    prisma.appointment.delete({ where: { id: appointmentId } }),
  ]);

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

export async function createDoctorTimeOff(formData: FormData) {
  const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const timeZone = getCalendarFormTimeZone(formData);
    const doctorId = (formData.get("doctorId") as string) || "";
    const startDate = (formData.get("startDate") as string) || "";
    const endDate = (formData.get("endDate") as string) || startDate;
    const title = (formData.get("title") as string)?.trim() || "Ferie";

    if (!doctorId) {
      throw new Error("Seleziona un medico.");
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) {
      throw new Error("Medico non trovato.");
    }

    const { startsAt, endsAt } = parseDoctorTimeOffDateRange(startDate, endDate, timeZone);

    const timeOff = await prisma.doctorTimeOff.create({
      data: {
        doctorId,
        title,
        startsAt,
        endsAt,
      },
    });

    await logAudit(user, {
      action: "doctorTimeOff.created",
      entity: "DoctorTimeOff",
      entityId: timeOff.id,
      metadata: { doctorId, title, startDate, endDate },
    });

    revalidatePath("/calendar");
    redirect(returnTo);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante il salvataggio delle ferie.";
    redirect(appendCalendarQueryParam(returnTo, "error", message));
  }
}

export async function deleteDoctorTimeOff(formData: FormData) {
  const returnTo = ensureCalendarReturnTo((formData.get("returnTo") as string) || "");

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const timeOffId = (formData.get("timeOffId") as string) || "";

    if (!timeOffId) {
      throw new Error("Periodo ferie non valido.");
    }

    const existing = await prisma.doctorTimeOff.findUnique({
      where: { id: timeOffId },
      select: { id: true, doctorId: true, title: true },
    });
    if (!existing) {
      throw new Error("Periodo ferie non trovato.");
    }

    await prisma.doctorTimeOff.delete({ where: { id: timeOffId } });

    await logAudit(user, {
      action: "doctorTimeOff.deleted",
      entity: "DoctorTimeOff",
      entityId: existing.id,
      metadata: { doctorId: existing.doctorId, title: existing.title },
    });

    revalidatePath("/calendar");
    redirect(returnTo);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante la rimozione delle ferie.";
    redirect(appendCalendarQueryParam(returnTo, "error", message));
  }
}
