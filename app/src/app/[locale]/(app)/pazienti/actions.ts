"use server";
import { ASSISTANT_ROLE } from "@/lib/roles";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Role, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizeItalianPhone } from "@/lib/phone";
import { parseOptionalDate } from "@/lib/date";
import { normalizePersonName } from "@/lib/name";
import { put } from "@vercel/blob";
import { sendEmail } from "@/lib/email";
import { stackServerApp } from "@/lib/stack-app";
import sharp from "sharp";

function withParam(url: string, key: string, value: string) {
  const hasQuery = url.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) {
    return "";
  }
  if (/^https?:\/\//.test(rawOrigin)) {
    return rawOrigin.replace(/\/$/, "");
  }
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function resolveSiteOrigin() {
  if (process.env.NODE_ENV === "production") {
    return normalizeSiteOrigin(
      process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
    );
  }
  return normalizeSiteOrigin(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL);
}

export async function createPatient(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

  const firstName = normalizePersonName((formData.get("firstName") as string) ?? "");
  const lastName = normalizePersonName((formData.get("lastName") as string) ?? "");
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const phone = normalizeItalianPhone((formData.get("phone") as string) ?? null);
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const taxId = (formData.get("taxId") as string)?.trim() || null;
  const birthDateValue = formData.get("birthDate");
  const conditions = formData.getAll("conditions").map((c) => (c as string).trim()).filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim();
  const extraNotes = (formData.get("extraNotes") as string)?.trim();
  const consentPlace = (formData.get("consentPlace") as string)?.trim();
  const consentDate = (formData.get("consentDate") as string)?.trim();
  const patientSignature = (formData.get("patientSignature") as string)?.trim();
  const doctorSignature = (formData.get("doctorSignature") as string)?.trim();
  const consentSignatureData = (formData.get("consentSignatureData") as string)?.trim();
  const consentModuleId = (formData.get("consentModuleId") as string)?.trim();
  const consentChannel = ((formData.get("consentChannel") as string) ?? "Di persona").trim() || "Di persona";
  const consentExpiresAtStr = (formData.get("consentExpiresAt") as string) ?? "";
  const photo = formData.get("photo") as File | null;

  const signatureBase64 = consentSignatureData?.startsWith("data:image/png")
    ? consentSignatureData.replace(/^data:image\/png;base64,/, "")
    : consentSignatureData
      ? consentSignatureData
      : null;
  const signatureBuffer = signatureBase64 ? Buffer.from(signatureBase64, "base64") : null;

  const birthDate = parseOptionalDate(birthDateValue);

  if (!firstName || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }
  let consentModule: { id: string; name: string } | null = null;
  let signedOn: Date | null = null;
  let expiresAt: Date | null = null;

  if (consentModuleId) {
    if (!signatureBuffer) {
      throw new Error("Firma digitale obbligatoria");
    }
    if (!patientSignature) {
      throw new Error("Firma del paziente obbligatoria (nome leggibile).");
    }

    consentModule = await prisma.consentModule.findFirst({
      where: { id: consentModuleId, active: true },
      select: { id: true, name: true },
    });
    if (!consentModule) {
      throw new Error("Modulo consenso non valido o disattivato.");
    }
    signedOn = consentDate ? new Date(consentDate) : null;
    if (signedOn && Number.isNaN(signedOn.getTime())) {
      throw new Error("Data consenso non valida.");
    }
    expiresAt = consentExpiresAtStr ? new Date(consentExpiresAtStr) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("Data scadenza non valida.");
    }
  }

  const structuredNotesText = [
    address || city ? `Indirizzo: ${address ?? "—"}${city ? `, ${city}` : ""}` : null,
    taxId ? `Codice Fiscale: ${taxId}` : null,
    conditions.length > 0 ? `Anamnesi: ${conditions.join(", ")}` : null,
    medications ? `Farmaci: ${medications}` : null,
    extraNotes ? `Note aggiuntive: ${extraNotes}` : null,
    consentModule
      ? `Consenso ${consentModule.name} firmato${consentPlace ? ` a ${consentPlace}` : ""}${
          consentDate ? ` il ${consentDate}` : ""
        }. Firma paziente: ${patientSignature || "—"} · Firma medico: ${doctorSignature || "—"}`
      : null,
    consentModule ? "Firma digitale acquisita." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      notes: structuredNotesText || null,
    },
  });

  if (consentModule && signatureBuffer) {
    const consentSignatureUrl = consentSignatureData?.startsWith("data:image/")
      ? consentSignatureData
      : signatureBase64
        ? `data:image/png;base64,${signatureBase64}`
        : null;

    await prisma.patientConsent.create({
      data: {
        patientId: patient.id,
        moduleId: consentModule.id,
        status: ConsentStatus.GRANTED,
        channel: consentChannel,
        givenAt: new Date(),
        signedOn,
        expiresAt,
        signatureUrl: consentSignatureUrl,
        place: consentPlace || null,
        patientName: patientSignature || null,
        doctorName: doctorSignature || null,
      },
    });
  }

  const updates: Prisma.PatientUpdateInput = {};

  if (photo && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    const blobName = `patients/${patient.id}/photo-${Date.now()}.jpg`;
    const blob = await put(blobName, resized, { access: "public", addRandomSuffix: false });
    updates.photoUrl = blob.url;
  }

  if (signatureBuffer) {
    const signatureName = `signatures/${patient.id}/signature-${Date.now()}.png`;
    const signatureBlob = await put(signatureName, signatureBuffer, { access: "public", addRandomSuffix: false });
    updates.notes = `${structuredNotesText}\nFirma digitale: ${signatureBlob.url}`;
  }

  await prisma.patient.update({
    where: { id: patient.id },
    data: updates,
  });

  await logAudit(user, {
    action: "patient.created",
    entity: "Patient",
    entityId: patient.id,
    metadata: {
      patientName: `${patient.lastName} ${patient.firstName}`,
      consentAgreement: true,
      taxIdProvided: Boolean(taxId),
      conditionsCount: conditions.length,
      hasDigitalSignature: Boolean(signatureBuffer),
    },
  });

  if (email) {
    const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";
    const patientSignInUrl = withParam(signInUrl, "audience", "patient");
    const siteOrigin = resolveSiteOrigin();
    const loginUrl = /^https?:\/\//.test(patientSignInUrl)
      ? patientSignInUrl
      : siteOrigin
        ? `${siteOrigin}${patientSignInUrl}`
        : patientSignInUrl;
    const subject = "Accesso area pazienti";
    const body = `Ciao ${firstName},

Abbiamo creato il tuo profilo paziente. Accedi qui per visualizzare e gestire gli appuntamenti:
${loginUrl}

Se hai bisogno di assistenza, contatta la segreteria.`;
    await sendEmail(email, subject, body);
  }

  revalidatePath("/pazienti");
  revalidatePath("/pazienti/nuovo");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
