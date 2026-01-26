"use server";
import { ASSISTANT_ROLE } from "@/lib/roles";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Role, ConsentStatus, Gender } from "@prisma/client";
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
import { pickRandomSystemAvatar, pickSystemAvatar } from "@/lib/patient-avatars";

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
  const genderRaw = (formData.get("gender") as string) || Gender.NOT_SPECIFIED;
  const gender = Object.values(Gender).includes(genderRaw as Gender)
    ? (genderRaw as Gender)
    : Gender.NOT_SPECIFIED;
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
  const consentModuleIds = formData
    .getAll("consentModuleIds[]")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const consentSignatureDataList = formData
    .getAll("consentSignatureData[]")
    .map((value) => String(value).trim());
  const consentPlaces = formData.getAll("consentPlace[]").map((value) => String(value).trim());
  const consentDates = formData.getAll("consentDate[]").map((value) => String(value).trim());
  const patientSignatures = formData.getAll("patientSignature[]").map((value) => String(value).trim());
  const doctorSignatures = formData.getAll("doctorSignature[]").map((value) => String(value).trim());
  const consentChannels = formData.getAll("consentChannel[]").map((value) => String(value).trim());
  const consentExpiresAtList = formData.getAll("consentExpiresAt[]").map((value) => String(value).trim());
  const photo = formData.get("photo") as File | null;
  const postCreateRedirect = (formData.get("postCreateRedirect") as string)?.trim() || "dashboard";

  const birthDate = parseOptionalDate(birthDateValue);

  if (!firstName || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }
  const buildSignatureParts = (rawValue: string | null | undefined) => {
    const trimmed = rawValue?.trim() ?? "";
    if (!trimmed) {
      return { signatureBase64: null as string | null, signatureBuffer: null as Buffer | null, signatureUrl: null as string | null };
    }
    const signatureBase64 = trimmed.startsWith("data:image/png")
      ? trimmed.replace(/^data:image\/png;base64,/, "")
      : trimmed;
    const signatureBuffer = signatureBase64 ? Buffer.from(signatureBase64, "base64") : null;
    const signatureUrl = trimmed.startsWith("data:image/")
      ? trimmed
      : signatureBase64
        ? `data:image/png;base64,${signatureBase64}`
        : null;
    return { signatureBase64, signatureBuffer, signatureUrl };
  };

  const hasMultiConsents = consentModuleIds.length > 0;
  const consentEntries = hasMultiConsents
    ? consentModuleIds.map((moduleId, index) => ({
        moduleId,
        place: consentPlaces[index] ?? "",
        date: consentDates[index] ?? "",
        patientSignature: patientSignatures[index] ?? "",
        doctorSignature: doctorSignatures[index] ?? "",
        signatureData: consentSignatureDataList[index] ?? "",
        channel: consentChannels[index] || "Di persona",
        expiresAtStr: consentExpiresAtList[index] ?? "",
      }))
    : consentModuleId
      ? [
          {
            moduleId: consentModuleId,
            place: consentPlace ?? "",
            date: consentDate ?? "",
            patientSignature: patientSignature ?? "",
            doctorSignature: doctorSignature ?? "",
            signatureData: consentSignatureData ?? "",
            channel: consentChannel || "Di persona",
            expiresAtStr: consentExpiresAtStr ?? "",
          },
        ]
      : [];

  if (!hasMultiConsents && consentModuleId && !consentSignatureData) {
    throw new Error("Firma digitale obbligatoria");
  }

  const consentsToCreate = consentEntries
    .filter((entry) => entry.moduleId && entry.signatureData)
    .map((entry) => {
      if (!entry.patientSignature) {
        throw new Error("Firma del paziente obbligatoria (nome leggibile).");
      }
      const signedOn = entry.date ? new Date(entry.date) : null;
      if (signedOn && Number.isNaN(signedOn.getTime())) {
        throw new Error("Data consenso non valida.");
      }
      const expiresAt = entry.expiresAtStr ? new Date(entry.expiresAtStr) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        throw new Error("Data scadenza non valida.");
      }
      const signatureParts = buildSignatureParts(entry.signatureData);
      return { ...entry, signedOn, expiresAt, ...signatureParts };
    });

  const consentModules = consentsToCreate.length
    ? await prisma.consentModule.findMany({
        where: { id: { in: consentsToCreate.map((entry) => entry.moduleId) }, active: true },
        select: { id: true, name: true },
      })
    : [];
  const consentModulesMap = new Map(consentModules.map((module) => [module.id, module]));
  if (consentsToCreate.length && consentModules.length !== consentsToCreate.length) {
    throw new Error("Modulo consenso non valido o disattivato.");
  }

  const requiredModules = await prisma.consentModule.findMany({
    where: { active: true, required: true },
    select: { id: true, name: true },
  });
  const missingRequired = requiredModules.filter(
    (module) => !consentsToCreate.some((entry) => entry.moduleId === module.id),
  );
  if (missingRequired.length > 0) {
    throw new Error("Mancano consensi obbligatori.");
  }

  const consentNotes = consentsToCreate.map((entry) => {
    const moduleName = consentModulesMap.get(entry.moduleId)?.name ?? "Consenso";
    return `Consenso ${moduleName} firmato${entry.place ? ` a ${entry.place}` : ""}${
      entry.date ? ` il ${entry.date}` : ""
    }. Firma paziente: ${entry.patientSignature || "—"} · Firma medico: ${entry.doctorSignature || "—"}`;
  });
  const structuredNotesText = [
    address || city ? `Indirizzo: ${address ?? "—"}${city ? `, ${city}` : ""}` : null,
    taxId ? `Codice Fiscale: ${taxId}` : null,
    conditions.length > 0 ? `Anamnesi: ${conditions.join(", ")}` : null,
    medications ? `Farmaci: ${medications}` : null,
    extraNotes ? `Note aggiuntive: ${extraNotes}` : null,
    ...consentNotes,
    consentsToCreate.length > 0 ? "Firma digitale acquisita." : null,
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
      gender,
      notes: structuredNotesText || null,
    },
  });

  if (consentsToCreate.length > 0) {
    await Promise.all(
      consentsToCreate.map((entry) =>
        prisma.patientConsent.create({
          data: {
            patientId: patient.id,
            moduleId: entry.moduleId,
            status: ConsentStatus.GRANTED,
            channel: entry.channel,
            givenAt: new Date(),
            signedOn: entry.signedOn,
            expiresAt: entry.expiresAt,
            signatureUrl: entry.signatureUrl,
            place: entry.place || null,
            patientName: entry.patientSignature || null,
            doctorName: entry.doctorSignature || null,
          },
        })
      )
    );
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
  } else {
    updates.photoUrl =
      gender === Gender.NOT_SPECIFIED
        ? pickRandomSystemAvatar(gender)
        : pickSystemAvatar(patient.id, gender);
  }

  if (consentsToCreate.length > 0) {
    const signatureLines: string[] = [];
    for (const entry of consentsToCreate) {
      if (!entry.signatureBuffer) continue;
      const moduleName = consentModulesMap.get(entry.moduleId)?.name ?? "Consenso";
      const signatureName = `signatures/${patient.id}/${entry.moduleId}-${Date.now()}.png`;
      const signatureBlob = await put(signatureName, entry.signatureBuffer, {
        access: "public",
        addRandomSuffix: false,
      });
      signatureLines.push(`Firma digitale (${moduleName}): ${signatureBlob.url}`);
    }
    if (signatureLines.length > 0) {
      updates.notes = [structuredNotesText, ...signatureLines].filter(Boolean).join("\n");
    }
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
      consentAgreement: consentsToCreate.length > 0,
      taxIdProvided: Boolean(taxId),
      conditionsCount: conditions.length,
      hasDigitalSignature: consentsToCreate.some((entry) => Boolean(entry.signatureBuffer)),
      consentsCount: consentsToCreate.length,
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
  const redirectTarget =
    postCreateRedirect === "patients"
      ? "/pazienti"
      : postCreateRedirect === "patient_detail"
        ? `/pazienti/${patient.id}`
        : "/dashboard";
  redirect(redirectTarget);
}
