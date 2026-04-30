"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus, Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import {
  adjustAppointmentEndsAt,
  isAppointmentStatus,
  isSameAgendaAppointmentSlot,
} from "@/lib/appointments/agenda-domain";
import { hasDoctorConflict, isNextRedirectError, FALLBACK_APPOINTMENT_SERVICES } from "@/lib/appointments/agenda";

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
      const conflict = await hasDoctorConflict();
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

  await prisma.$transaction([
    prisma.appointmentReminder.deleteMany({ where: { appointmentId } }),
    prisma.appointment.delete({ where: { id: appointmentId } }),
  ]);

  await logAudit(user, {
    action: "appointment.deleted",
    entity: "Appointment",
    entityId: appointmentId,
  });

  revalidatePath("/agenda/appuntamenti");
  redirect("/agenda/appuntamenti");
}
