"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { Gender, Role } from "@prisma/client";
import sharp from "sharp";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parseOptionalBirthDate } from "@/lib/date";
import { sendPatientWelcomeEmail } from "@/lib/welcome-email";
import { normalizePersonName } from "@/lib/name";
import { normalizeItalianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { sendSms } from "@/lib/sms";
import { getStackSignInUrl } from "@/lib/stack-app";
import { withPaperConsentNote } from "@/lib/patients/paper-consent";
import { isRedirectError, resolveSiteOrigin, withParam } from "@/lib/utils";

const STAFF_ROLES = [Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY] as const;

export async function uploadPhotoAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = formData.get("patientId") as string;
  const file = formData.get("photo") as File | null;

  if (!patientId || !file || file.size === 0) {
    throw new Error("File non valido");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const resized = await sharp(buffer).resize(512, 512, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  const blobName = `patients/${patientId}/photo-${Date.now()}.jpg`;
  const blob = await put(blobName, resized, { access: "public", addRandomSuffix: false });

  await prisma.patient.update({
    where: { id: patientId },
    data: { photoUrl: blob.url },
  });

  await logAudit(user, {
    action: "patient.photo_uploaded",
    entity: "Patient",
    entityId: patientId,
    metadata: { size: file.size },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

export async function resetPhotoAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paziente non valido");

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, gender: true, notes: true },
  });
  if (!patient) throw new Error("Paziente non trovato");

  const taxIdLine = (patient.notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("Codice Fiscale:"));
  const taxId = taxIdLine?.replace("Codice Fiscale:", "").trim() || null;
  const { resolveStoredPatientPhotoUrl } = await import("@/lib/patient-avatars");

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      photoUrl: resolveStoredPatientPhotoUrl({
        patientId,
        firstName: patient.firstName,
        gender: patient.gender,
        taxId,
      }),
    },
  });

  await logAudit(user, {
    action: "patient.photo_reset",
    entity: "Patient",
    entityId: patientId,
  });

  revalidatePath(`/pazienti/${patientId}`);
}

export async function updatePatientAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);

  const id = (formData.get("patientId") as string) || "";
  const firstName = normalizePersonName((formData.get("firstName") as string) ?? "");
  const lastName = normalizePersonName((formData.get("lastName") as string) ?? "");
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const phone = normalizeItalianPhone((formData.get("phone") as string) ?? null);
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const taxIdRaw = (formData.get("taxId") as string)?.trim() || null;
  const taxId = taxIdRaw ? taxIdRaw.toLocaleUpperCase("it") : null;
  const genderRaw = (formData.get("gender") as string) || Gender.NOT_SPECIFIED;
  const gender = Object.values(Gender).includes(genderRaw as Gender)
    ? (genderRaw as Gender)
    : Gender.NOT_SPECIFIED;
  const conditions = formData.getAll("conditions").map((c) => (c as string).trim()).filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim() || null;
  const extraNotes = (formData.get("extraNotes") as string)?.trim() || null;
  const birthDateValue = formData.get("birthDate");

  if (!id || !firstName || !lastName) {
    throw new Error("Dati paziente non validi");
  }

  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { notes: true, photoUrl: true, gender: true, firstName: true },
  });
  const existingLines = (existing?.notes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const preservedLines = existingLines.filter(
    (line) =>
      !line.startsWith("Indirizzo:") &&
      !line.startsWith("Codice Fiscale:") &&
      !line.startsWith("Anamnesi:") &&
      !line.startsWith("Farmaci:") &&
      !line.startsWith("Note aggiuntive:") &&
      !line.startsWith("Note:")
  );

  const birthDate = parseOptionalBirthDate(birthDateValue);
  const { isSystemAvatar, resolveStoredPatientPhotoUrl } = await import("@/lib/patient-avatars");
  const shouldAssignAvatar = !existing?.photoUrl || isSystemAvatar(existing.photoUrl);
  const nextPhotoUrl = shouldAssignAvatar
    ? resolveStoredPatientPhotoUrl({
        patientId: id,
        firstName,
        gender,
        taxId,
      })
    : existing?.photoUrl;

  await prisma.patient.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      gender,
      taxId,
      photoUrl: nextPhotoUrl,
      notes:
        [
          ...preservedLines,
          address || city ? `Indirizzo: ${address ?? "—"}${city ? `, ${city}` : ""}` : null,
          taxId ? `Codice Fiscale: ${taxId}` : null,
          conditions.length ? `Anamnesi: ${conditions.join(", ")}` : null,
          medications ? `Farmaci: ${medications}` : null,
          extraNotes ? `Note aggiuntive: ${extraNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
      birthDate,
    },
  });

  await logAudit(user, {
    action: "patient.updated",
    entity: "Patient",
    entityId: id,
    metadata: {
      emailChanged: Boolean(email),
      patientName: `${lastName} ${firstName}`,
      conditions,
      medications,
      extraNotes,
      birthDate: birthDate?.toISOString() ?? null,
      gender,
    },
  });

  revalidatePath(`/pazienti/${id}`);
  revalidatePath("/pazienti");
  redirect(`/pazienti/${id}?openContact=1`);
}

export async function sendPatientSmsAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = (formData.get("patientId") as string) ?? "";
  const templateId = (formData.get("templateId") as string) ?? "";

  try {
    if (!patientId || !templateId) throw new Error("Seleziona un template e un paziente");

    const [template, patient, upcomingAppointment] = await Promise.all([
      prisma.smsTemplate.findUnique({ where: { id: templateId } }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { phone: true, firstName: true, lastName: true },
      }),
      prisma.appointment.findFirst({
        where: {
          patientId,
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        include: { doctor: { select: { fullName: true } } },
      }),
    ]);

    if (!template) throw new Error("Template non trovato");
    if (!patient?.phone) {
      redirect(
        `/pazienti/${patientId}?smsError=${encodeURIComponent(
          "Aggiungi un numero di telefono al profilo del paziente prima di inviare un SMS."
        )}`
      );
    }

    const appointmentDate = upcomingAppointment?.startsAt
      ? new Intl.DateTimeFormat("it-IT", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(upcomingAppointment.startsAt)
      : "";
    const body = template.body
      .replaceAll("{{nome}}", patient.firstName ?? "")
      .replaceAll("{{cognome}}", patient.lastName ?? "")
      .replaceAll("{{dottore}}", upcomingAppointment?.doctor?.fullName ?? "")
      .replaceAll("{{data_appuntamento}}", appointmentDate)
      .replaceAll("{{motivo_visita}}", upcomingAppointment?.serviceType ?? "")
      .replaceAll("{{note}}", upcomingAppointment?.notes ?? "");

    await sendSms({
      to: patient.phone,
      body,
      templateId,
      patientId,
      userId: user.id,
    });

    await logAudit(user, {
      action: "sms.sent",
      entity: "Patient",
      entityId: patientId,
      metadata: { templateId },
    });

    revalidatePath(`/pazienti/${patientId}`);
    redirect(`/pazienti/${patientId}?smsSuccess=${encodeURIComponent("SMS inviato con successo.")}`);
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Impossibile inviare l'SMS.";
    redirect(`/pazienti/${patientId || ""}?smsError=${encodeURIComponent(message)}`);
  }
}

export async function sendPatientAccessEmailAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = (formData.get("patientId") as string) ?? "";

  try {
    if (!patientId) throw new Error("Paziente non valido");

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!patient?.email) {
      redirect(
        `/pazienti/${patientId}?accessError=${encodeURIComponent(
          "Aggiungi un indirizzo email al profilo del paziente prima di inviare l'accesso."
        )}`
      );
    }

    const signInUrl = getStackSignInUrl();
    const patientSignInUrl = withParam(signInUrl, "audience", "patient");
    const siteOrigin = resolveSiteOrigin();
    const loginUrl = /^https?:\/\//.test(patientSignInUrl)
      ? patientSignInUrl
      : siteOrigin
        ? `${siteOrigin}${patientSignInUrl}`
        : patientSignInUrl;
    const patientName = patient.firstName
      ? `${patient.firstName} ${patient.lastName ?? ""}`.trim()
      : `Sig. ${patient.lastName ?? ""}`.trim();

    await sendPatientWelcomeEmail(patient.email, {
      patientName,
      loginUrl,
    });

    await logAudit(user, {
      action: "patient.access_email_sent",
      entity: "Patient",
      entityId: patientId,
      metadata: { email: patient.email },
    });

    revalidatePath(`/pazienti/${patientId}`);
    redirect(`/pazienti/${patientId}?accessSuccess=${encodeURIComponent("Email inviata con successo.")}`);
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Impossibile inviare l'email.";
    redirect(`/pazienti/${patientId || ""}?accessError=${encodeURIComponent(message)}`);
  }
}

export async function updatePaperConsentAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = (formData.get("patientId") as string) || "";
  const hasPaperConsentForRequired = formData.get("hasPaperConsentForRequired") === "on";

  if (!patientId) {
    throw new Error("Paziente non valido");
  }

  const existing = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { notes: true, firstName: true, lastName: true },
  });
  if (!existing) {
    throw new Error("Paziente non trovato");
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      hasPaperConsentForRequired,
      notes: withPaperConsentNote(existing.notes, hasPaperConsentForRequired),
    },
  });

  await logAudit(user, {
    action: "patient.paper_consent_updated",
    entity: "Patient",
    entityId: patientId,
    metadata: {
      patientName: `${existing.lastName} ${existing.firstName}`,
      hasPaperConsentForRequired,
    },
  });

  revalidatePath(`/pazienti/${patientId}`);
  revalidatePath("/pazienti/lista");
}
