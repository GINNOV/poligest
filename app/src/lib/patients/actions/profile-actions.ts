"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { Gender, Role } from "@prisma/client";
import sharp from "sharp";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/date";
import { sendEmailWithHtml } from "@/lib/email";
import { normalizePersonName } from "@/lib/name";
import { normalizeItalianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { sendSms } from "@/lib/sms";
import { stackServerApp } from "@/lib/stack-app";
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

  await prisma.patient.update({
    where: { id: patientId },
    data: { photoUrl: null },
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
  const taxId = (formData.get("taxId") as string)?.trim() || null;
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
    select: { notes: true, photoUrl: true, gender: true },
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

  const birthDate = parseOptionalDate(birthDateValue);
  const { isSystemAvatar, pickRandomSystemAvatar, pickSystemAvatar } = await import("@/lib/patient-avatars");
  const shouldAssignAvatar =
    !existing?.photoUrl || (isSystemAvatar(existing.photoUrl) && existing.gender !== gender);
  const nextPhotoUrl = shouldAssignAvatar
    ? gender === Gender.NOT_SPECIFIED
      ? pickRandomSystemAvatar(gender)
      : pickSystemAvatar(id, gender)
    : existing?.photoUrl;

  await prisma.patient.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      gender,
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

    const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";
    const patientSignInUrl = withParam(signInUrl, "audience", "patient");
    const siteOrigin = resolveSiteOrigin();
    const loginUrl = /^https?:\/\//.test(patientSignInUrl)
      ? patientSignInUrl
      : siteOrigin
        ? `${siteOrigin}${patientSignInUrl}`
        : patientSignInUrl;
    const subject = "Accesso area pazienti";
    const body = `Gentile Sig. ${patient.lastName ?? ""},

La informiamo che l’accesso alla Sua area paziente è stato attivato con successo.

Attraverso il seguente link potrà visualizzare e gestire i Suoi appuntamenti in modo semplice e sicuro:
${loginUrl}

Per eventuali chiarimenti o necessità di assistenza, La invitiamo a contattare la segreteria.

Cordiali saluti,


Telefono: 081 8654557
Email: studio.agovino.agrisano@gmail.com`;

    const baseOrigin = siteOrigin || "http://localhost:3000";
    const logoUrl = `${baseOrigin}/logo/studio_agovinoangrisano_logo.png`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f0fdf4; padding: 24px;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #d1fae5; border-radius: 16px; padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #d1fae5; border-radius: 14px; background: #f8fffb;">
            <tr>
              <td style="padding: 12px 14px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding-right: 12px;">
                      <img src="${logoUrl}" alt="Studio Agovino & Angrisano" width="48" height="48" style="display:block; border-radius:12px; border:1px solid #d1fae5; padding:4px; background:#ffffff; object-fit: contain;" />
                    </td>
                    <td>
                      <div style="font-size: 12px; letter-spacing: 0.2em; font-weight: 700; text-transform: uppercase; color: #064e3b;">
                        Studio Agovino &amp; Angrisano
                      </div>
                      <div style="font-size: 11px; letter-spacing: 0.18em; font-weight: 700; text-transform: uppercase; color: #047857;">
                        by NoMore Caries
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <div style="margin-top: 18px; color: #0f172a; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 12px;">Gentile Sig. ${patient.lastName ?? ""},</p>
            <p style="margin: 0 0 12px;">La informiamo che l’accesso alla Sua area paziente è stato attivato con successo.</p>
            <p style="margin: 0 0 12px;">Attraverso il seguente link potrà visualizzare e gestire i Suoi appuntamenti in modo semplice e sicuro:</p>
            <p style="margin: 0 0 16px;">
              <a href="${loginUrl}" style="display: inline-block; background: #047857; color: #ffffff; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none;">
                Accedi all&apos;area paziente
              </a>
            </p>
            <p style="margin: 0 0 12px;">Per eventuali chiarimenti o necessità di assistenza, La invitiamo a contattare la segreteria.</p>
            <p style="margin: 0 0 16px;">Cordiali saluti,</p>
            <p style="margin: 0;">Telefono: 081 8654557<br/>Email: studio.agovino.agrisano@gmail.com</p>
          </div>
        </div>
      </div>
    `;

    await sendEmailWithHtml(patient.email, subject, body, html);

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
