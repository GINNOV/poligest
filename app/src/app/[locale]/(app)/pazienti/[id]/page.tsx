import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role, AppointmentStatus, StockMovementType, ConsentStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PatientAvatar } from "@/components/patient-avatar";
import sharp from "sharp";
import { DentalChart } from "@/components/dental-chart";
import { sendSms } from "@/lib/sms";
import { ConsentForm } from "@/components/consent-form";
import { normalizeItalianPhone } from "@/lib/phone";
import { parseOptionalDate } from "@/lib/date";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { put } from "@vercel/blob";
import { getAnamnesisConditions } from "@/lib/anamnesis";
import { QuoteAccordion } from "@/components/quote-accordion";
import { sendEmailWithHtml } from "@/lib/email";
import { stackServerApp } from "@/lib/stack-app";
import { PageToastTrigger } from "@/components/page-toast-trigger";
import { PatientDeleteButton } from "@/components/patient-delete-button";

const consentStatusLabels: Record<string, string> = {
  GRANTED: "Concesso",
  REVOKED: "Revocato",
  EXPIRED: "Scaduto",
};

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

const statusClasses: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800 shadow-sm",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800 shadow-sm",
  COMPLETED: "border-green-200 bg-green-50 text-green-800 shadow-sm",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 shadow-sm",
  NO_SHOW: "border-slate-200 bg-slate-50 text-slate-700 shadow-sm",
};

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

async function updateAppointmentStatus(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
  const patientId = formData.get("patientId") as string;
  const status = formData.get("status") as AppointmentStatus;

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

  revalidatePath("/pazienti");
  if (patientId) {
    revalidatePath(`/pazienti/${patientId}`);
  }
}

async function addImplantAssociation(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = (formData.get("patientId") as string) || "";
  const productId = (formData.get("productId") as string) || "";
  const deviceType = (formData.get("deviceType") as string)?.trim() || null;
  const brand = (formData.get("brand") as string)?.trim() || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  const udiPi = (formData.get("udiPi") as string)?.trim() || null;
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!patientId || !productId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;

  await prisma.stockMovement.create({
    data: {
      productId,
      quantity: 1,
      movement: StockMovementType.OUT,
      note: [
        deviceType ? `Tipo: ${deviceType}` : null,
        brand ? `Marca: ${brand}` : null,
        udiDi ? `UDI-DI: ${udiDi}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      patientId,
      udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_added",
    entity: "Patient",
    entityId: patientId,
    metadata: { productId, udiPi, brand, deviceType, interventionSite },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

async function updateImplantAssociation(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const implantId = (formData.get("implantId") as string) || "";
  const patientId = (formData.get("patientId") as string) || "";
  const productId = (formData.get("productId") as string) || "";
  const deviceType = (formData.get("deviceType") as string)?.trim() || null;
  const brand = (formData.get("brand") as string)?.trim() || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  const udiPi = (formData.get("udiPi") as string)?.trim() || null;
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!implantId || !patientId || !productId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;

  await prisma.stockMovement.update({
    where: { id: implantId },
    data: {
      productId,
      note: [
        deviceType ? `Tipo: ${deviceType}` : null,
        brand ? `Marca: ${brand}` : null,
        udiDi ? `UDI-DI: ${udiDi}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_updated",
    entity: "Patient",
    entityId: patientId,
    metadata: { implantId, productId },
  });

  revalidatePath(`/pazienti/${patientId}`);
}
async function uploadPhoto(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const patientId = formData.get("patientId") as string;
  const file = formData.get("photo") as File | null;

  if (!patientId || !file || file.size === 0) {
    throw new Error("File non valido");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const resized = await sharp(buffer)
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();
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

async function updatePatient(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const id = (formData.get("patientId") as string) || "";
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const phone = normalizeItalianPhone((formData.get("phone") as string) ?? null);
  const conditions = formData
    .getAll("conditions")
    .map((c) => (c as string).trim())
    .filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim() || null;
  const extraNotes = (formData.get("extraNotes") as string)?.trim() || null;
  const birthDateValue = formData.get("birthDate");

  if (!id || !firstName || !lastName) {
    throw new Error("Dati paziente non validi");
  }

  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { notes: true },
  });
  const existingLines =
    (existing?.notes ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean) ?? [];
  const preservedLines = existingLines.filter(
    (line) =>
      !line.startsWith("Anamnesi:") &&
      !line.startsWith("Farmaci:") &&
      !line.startsWith("Note:")
  );

  const birthDate = parseOptionalDate(birthDateValue);

  await prisma.patient.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      notes:
        [
          ...preservedLines,
          conditions.length ? `Anamnesi: ${conditions.join(", ")}` : null,
          medications ? `Farmaci: ${medications}` : null,
          extraNotes ? `Note: ${extraNotes}` : null,
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
    },
  });

  revalidatePath(`/pazienti/${id}`);
  revalidatePath("/pazienti");
}

async function savePreventivo(_: { savedAt: number }, formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = (formData.get("patientId") as string) || "";
  const itemsRaw = (formData.get("itemsJson") as string) || "";
  const signatureData = (formData.get("quoteSignatureData") as string)?.trim();
  const existingSignatureUrl = (formData.get("existingQuoteSignatureUrl") as string)?.trim() || null;

  if (!patientId || !itemsRaw) {
    throw new Error("Preventivo non valido");
  }

  let itemsPayload: Array<{ serviceId: string; quantity: number; price: number; saldato?: boolean }> = [];
  try {
    itemsPayload = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Dati preventivo non validi");
  }

  if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
    throw new Error("Inserisci almeno una prestazione");
  }

  if (!signatureData?.startsWith("data:image/png") && !existingSignatureUrl) {
    throw new Error("Firma digitale obbligatoria");
  }

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args?: { where?: { id: { in: string[] } } }) => Promise<{ id: string; name: string }[]> }
    | undefined;
  const serviceIds = itemsPayload.map((item) => item.serviceId).filter(Boolean);
  const services =
    serviceClient?.findMany && serviceIds.length
      ? await serviceClient.findMany({ where: { id: { in: serviceIds } } })
      : [];
  const serviceNameMap = new Map(services.map((service) => [service.id, service.name]));

  const normalizedItems = itemsPayload.map((item) => {
    const quantityParsed = Number.parseInt(String(item.quantity), 10);
    const quantity = Number.isNaN(quantityParsed) || quantityParsed <= 0 ? 1 : quantityParsed;
    const priceParsed = Number.parseFloat(String(item.price).replace(",", "."));
    if (Number.isNaN(priceParsed)) {
      throw new Error("Prezzo non valido");
    }
    const serviceName = serviceNameMap.get(item.serviceId) ?? "Prestazione";
    const total = Number((priceParsed * quantity).toFixed(2));
    const saldato = Boolean(item.saldato);
    return {
      serviceId: item.serviceId,
      serviceName,
      quantity,
      price: priceParsed,
      total,
      saldato,
    };
  });

  let signatureUrl = existingSignatureUrl;
  if (signatureData?.startsWith("data:image/png")) {
    const signatureBuffer = Buffer.from(signatureData.replace(/^data:image\/png;base64,/, ""), "base64");
    const signatureName = `signatures/quotes/${patientId}/quote-${Date.now()}.png`;
    const signatureBlob = await put(signatureName, signatureBuffer, { access: "public", addRandomSuffix: false });
    signatureUrl = signatureBlob.url;
  }

  const totalSum = normalizedItems.reduce((sum, item) => sum + (item.saldato ? 0 : item.total), 0);
  const primaryItem = normalizedItems[0];

  const quote = await prisma.quote.create({
    data: {
      patientId,
      serviceId: primaryItem.serviceId,
      serviceName: primaryItem.serviceName,
      quantity: primaryItem.quantity,
      price: new Prisma.Decimal(primaryItem.price),
      total: new Prisma.Decimal(totalSum),
      signatureUrl: signatureUrl ?? "",
      signedAt: new Date(),
      items: {
        create: normalizedItems.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          quantity: item.quantity,
          price: new Prisma.Decimal(item.price),
          total: new Prisma.Decimal(item.total),
          saldato: item.saldato,
        })),
      },
    },
  });

  await logAudit(user, {
    action: "patient.quote_saved",
    entity: "Patient",
    entityId: patientId,
    metadata: {
      quoteId: quote.id,
      serviceId: primaryItem.serviceId,
      serviceName: primaryItem.serviceName,
      quantity: primaryItem.quantity,
      price: primaryItem.price,
      total: totalSum,
    },
  });

  revalidatePath(`/pazienti/${patientId}`);
  return { savedAt: Date.now() };
}

async function revokeConsent(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const consentId = (formData.get("consentId") as string) ?? "";

  if (!consentId) {
    throw new Error("Dati consenso non validi");
  }

  const existing = await prisma.patientConsent.findUnique({
    where: { id: consentId },
    select: { patientId: true },
  });

  if (!existing) {
    throw new Error("Consenso non trovato");
  }

  await prisma.patientConsent.update({
    where: { id: consentId },
    data: {
      status: ConsentStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await logAudit(user, {
    action: "consent.revoked",
    entity: "Patient",
    entityId: existing.patientId,
    metadata: { consentId },
  });

  revalidatePath(`/pazienti/${existing.patientId}`);
  redirect(`/pazienti/${existing.patientId}?consentSuccess=${encodeURIComponent("Consenso revocato.")}`);
}

async function sendPatientSms(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = (formData.get("patientId") as string) ?? "";
  const templateId = (formData.get("templateId") as string) ?? "";

  try {
    if (!patientId || !templateId) {
      throw new Error("Seleziona un template e un paziente");
    }

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

    if (!template) {
      throw new Error("Template non trovato");
    }

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
  } catch (err: any) {
    // Allow redirects to propagate.
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err?.message ?? "Impossibile inviare l'SMS.";
    redirect(`/pazienti/${patientId || ""}?smsError=${encodeURIComponent(message)}`);
  }
}

async function sendPatientAccessEmail(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = (formData.get("patientId") as string) ?? "";

  try {
    if (!patientId) {
      throw new Error("Paziente non valido");
    }

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
  } catch (err: any) {
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err?.message ?? "Impossibile inviare l'email.";
    redirect(`/pazienti/${patientId || ""}?accessError=${encodeURIComponent(message)}`);
  }
}

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const isAdmin = user.role === Role.ADMIN;
  const canExport = isAdmin || user.role === Role.MANAGER;

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }
  const smsErrorMessage =
    typeof resolvedSearchParams.smsError === "string" ? resolvedSearchParams.smsError : null;
  const smsSuccessMessage =
    typeof resolvedSearchParams.smsSuccess === "string" ? resolvedSearchParams.smsSuccess : null;
  const accessErrorMessage =
    typeof resolvedSearchParams.accessError === "string" ? resolvedSearchParams.accessError : null;
  const accessSuccessMessage =
    typeof resolvedSearchParams.accessSuccess === "string" ? resolvedSearchParams.accessSuccess : null;
  const consentErrorMessage =
    typeof resolvedSearchParams.consentError === "string"
      ? resolvedSearchParams.consentError
      : null;
  const consentSuccessMessage =
    typeof resolvedSearchParams.consentSuccess === "string"
      ? resolvedSearchParams.consentSuccess
      : null;
  const openContactPanel =
    typeof resolvedSearchParams.openContact === "string" &&
    resolvedSearchParams.openContact === "1";

  const [doctors, patient, consentModules] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        consents: {
          include: { module: true },
          orderBy: { givenAt: "desc" },
        },
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 5,
          include: {
            doctor: { select: { fullName: true, specialty: true } },
          },
        },
      },
    }),
    prisma.consentModule.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const conditionsList = await getAnamnesisConditions();

  if (!patient) {
    return (
      <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Paziente non trovato.</p>
        <Link
          href="/pazienti"
          className="mt-4 inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          Torna a Pazienti
        </Link>
      </div>
    );
  }

  const patientUser = patient.email
    ? await prisma.user.findFirst({
        where: { email: patient.email, role: Role.PATIENT },
        select: { personalPin: true },
      })
    : null;
  const patientPin = patientUser?.personalPin ?? "—";
  const patientPhone = normalizeItalianPhone(patient.phone);
  const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
  const upcomingAppointment =
    patient.appointments.find((appt) => appt.startsAt > new Date()) ?? patient.appointments[0];
  const appointmentDate = upcomingAppointment
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(upcomingAppointment.startsAt)
    : "da definire";
  const appointmentTime = upcomingAppointment
    ? new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(upcomingAppointment.startsAt)
    : "da definire";
  const appointmentDoctor = upcomingAppointment?.doctor?.fullName ?? "da definire";
  const whatsappMessage = `Ciao ${patient.firstName}, ti ricordiamo il tuo appuntamento presso lo studio. E' il giorno ${appointmentDate} alle ore ${appointmentTime}. Il dottore ${appointmentDoctor} sara' lieto di farti sorridere. Per maggiorni informazioni usa il nostro nuovo sito http://sorrisosplendente.com. A presto e ricordati SORRIDI con noi!`;
  const whatsappHref = whatsappPhone
    ? `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}`
    : null;

  const notesLines = (patient.notes ?? "").split("\n").map((line) => line.trim());
  const anamnesisLine = notesLines.find((line) => line.startsWith("Anamnesi:"));
  const parsedConditions = anamnesisLine
    ? anamnesisLine
        .replace("Anamnesi:", "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const medicationsLine = notesLines.find((line) => line.startsWith("Farmaci:"));
  const parsedMedications = medicationsLine?.replace("Farmaci:", "").trim() ?? "";
  const extraLine = notesLines.find((line) => line.startsWith("Note:"));
  const parsedExtra = extraLine?.replace("Note:", "").trim() ?? "";
  let parsedQuote: {
    id?: string;
    serviceId?: string;
    serviceName?: string;
    quantity?: number;
    price?: number;
    total?: number;
    signatureUrl?: string;
    signedAt?: string;
    items?: Array<{
      id?: string;
      serviceId?: string;
      serviceName?: string;
      quantity?: number;
      price?: number;
      total?: number;
      saldato?: boolean;
      createdAt?: string | null;
    }>;
  } | null = null;

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args?: { orderBy?: { createdAt?: "asc" | "desc" } }) => Promise<any[]> }
    | undefined;
  const quoteClient = prismaModels["quote"] as
    | {
        findFirst?: (args: {
          where: { patientId: string };
          orderBy: { createdAt: "desc" };
          include?: { items?: boolean };
        }) => Promise<any | null>;
      }
    | undefined;
  const [products, implants, dentalRecords, services, latestQuote] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
    prisma.stockMovement.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { product: { include: { supplier: true } } },
      take: 50,
    }),
    prisma.dentalRecord.findMany({
      where: { patientId },
      orderBy: { performedAt: "desc" },
      include: { updatedBy: { select: { name: true, email: true } } },
    }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    quoteClient?.findFirst
      ? quoteClient.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" }, include: { items: true } })
      : Promise.resolve(null),
  ]);
  if (latestQuote) {
    parsedQuote = {
      id: latestQuote.id,
      serviceId: latestQuote.serviceId,
      serviceName: latestQuote.serviceName,
      quantity: latestQuote.quantity,
      price: Number(latestQuote.price?.toString?.() ?? latestQuote.price ?? 0),
      total: Number(latestQuote.total?.toString?.() ?? latestQuote.total ?? 0),
      signatureUrl: latestQuote.signatureUrl,
      signedAt: latestQuote.signedAt?.toISOString?.() ?? null,
      items: Array.isArray(latestQuote.items)
        ? latestQuote.items.map((item: any) => ({
            id: item.id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            quantity: item.quantity,
            price: Number(item.price?.toString?.() ?? item.price ?? 0),
            total: Number(item.total?.toString?.() ?? item.total ?? 0),
            saldato: Boolean(item.saldato),
            createdAt: item.createdAt?.toISOString?.() ?? null,
          }))
        : undefined,
    };
  }
  const pastAppointments = patient.appointments
    .filter((appt) => appt.startsAt < new Date())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const dentalRecordsSerialized = dentalRecords.map((record) => ({
    ...record,
    performedAt: record.performedAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString?.() ?? null,
    updatedByName: record.updatedBy?.name ?? record.updatedBy?.email ?? null,
    treated: record.treated ?? false,
  }));
  const requiredModules = consentModules.filter((module) => module.active && module.required);
  const missingRequired = requiredModules.filter(
    (module) => !patient.consents.some((consent) => consent.moduleId === module.id),
  );
  const [smsTemplates, smsLogs] = await Promise.all([
    prisma.smsTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.smsLog.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { template: true },
    }),
  ]);

  return (
    <>
      <PageToastTrigger
        messages={[
          { key: "smsSuccess", message: smsSuccessMessage ?? "", variant: "success" },
          { key: "accessSuccess", message: accessSuccessMessage ?? "", variant: "success" },
          { key: "consentSuccess", message: consentSuccessMessage ?? "", variant: "success" },
        ]}
      />

      {smsErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="sms-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="sms-error-title" className="text-base font-semibold text-amber-900">
                  Impossibile inviare l&apos;SMS
                </p>
                <p className="text-sm text-zinc-700">{smsErrorMessage}</p>
                {smsErrorMessage.toLowerCase().includes("telefono") ? (
                  <p className="text-xs text-zinc-500">
                    Aggiungi o aggiorna il numero di telefono del paziente dalla sezione dati di
                    contatto, poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900"
              >
                Vai ai dati di contatto
              </Link>
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {accessErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="access-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="access-error-title" className="text-base font-semibold text-amber-900">
                  Impossibile inviare l&apos;email
                </p>
                <p className="text-sm text-zinc-700">{accessErrorMessage}</p>
                {accessErrorMessage.toLowerCase().includes("email") ? (
                  <p className="text-xs text-zinc-500">
                    Aggiungi o aggiorna l&apos;email del paziente dalla sezione dati di contatto,
                    poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900"
              >
                Vai ai dati di contatto
              </Link>
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {consentErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="consent-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="consent-error-title" className="text-base font-semibold text-amber-900">
                  Non possiamo salvare questo consenso
                </p>
                <p className="text-sm text-zinc-700">{consentErrorMessage}</p>
                {consentErrorMessage.toLowerCase().includes("esiste già") ? (
                  <p className="text-xs text-zinc-500">
                    Ogni tipo di consenso può essere registrato una sola volta per paziente. Modifica
                    quello esistente o scegli un tipo diverso.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <details
            className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden"
            open={openContactPanel}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  PIN {patientPin}
                </span>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 text-lg font-semibold text-emerald-800">
                  <PatientAvatar
                    src={patient.photoUrl}
                    alt={`${patient.lastName} ${patient.firstName}`}
                    size={56}
                    className="h-full w-full rounded-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-wide text-zinc-600">Scheda paziente</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-zinc-900">
                      {patient.lastName} {patient.firstName}
                    </h1>
                    <p className="text-sm text-zinc-700">
                      {patient.email ?? "—"} · {patient.phone ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-zinc-200 px-6 pb-6 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
                <form
                  action={uploadPhoto}
                  className="flex flex-col items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-xs shadow-sm"
                >
                  <input type="hidden" name="patientId" value={patient.id} />
                  <PatientAvatar
                    src={patient.photoUrl}
                    alt={`${patient.lastName} ${patient.firstName}`}
                    size={112}
                    className="h-28 w-28 rounded-full"
                  />
                  <label className="flex cursor-pointer flex-col items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600">
                    <span>Scegli foto</span>
                    <input
                      type="file"
                      name="photo"
                      accept="image/*"
                      className="hidden"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"
                  >
                    Salva foto
                  </button>
                </form>

                <div className="space-y-6" id="contact-info">
                  <UnsavedChangesGuard formId="patient-update-form" />
                  <form
                    action={updatePatient}
                    className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                    id="patient-update-form"
                  >
                    <input type="hidden" name="patientId" value={patient.id} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Nome
                        <input
                          name="firstName"
                          defaultValue={patient.firstName}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Cognome
                        <input
                          name="lastName"
                          defaultValue={patient.lastName}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Email
                        <input
                          name="email"
                          type="email"
                          defaultValue={patient.email ?? ""}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="email@esempio.it"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Telefono
                        <input
                          name="phone"
                          defaultValue={patient.phone ?? ""}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="+39..."
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Data di nascita
                        <input
                          type="date"
                          name="birthDate"
                          defaultValue={
                            patient.birthDate
                              ? new Date(patient.birthDate).toISOString().split("T")[0]
                              : ""
                          }
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-900">Anamnesi Generale</p>
                          <p className="text-xs text-zinc-500">
                            Seleziona eventuali condizioni mediche presenti o passate.
                          </p>
                        </div>
                        <div
                          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                          suppressHydrationWarning
                        >
                          {conditionsList.map((condition, index) => (
                            <label
                              key={`${condition}-${index}`}
                              className="inline-flex items-start gap-2 rounded-lg px-2 py-1 text-sm text-zinc-800"
                            >
                              <input
                                type="checkbox"
                                name="conditions"
                                value={condition}
                                defaultChecked={parsedConditions.includes(condition)}
                                className="mt-1 h-4 w-4 rounded border-zinc-300"
                              />
                              <span>{condition}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Farmaci
                        <textarea
                          name="medications"
                          defaultValue={parsedMedications}
                          rows={2}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Farmaci assunti regolarmente"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Note aggiuntive
                        <textarea
                          name="extraNotes"
                          defaultValue={parsedExtra}
                          rows={2}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Annotazioni cliniche o amministrative"
                        />
                      </label>
                    </div>
                  <div className="flex justify-end">
                    <FormSubmitButton className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                      Aggiorna
                    </FormSubmitButton>
                  </div>
                </form>

                </div>
              </div>
            </div>
          </details>

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
              <span className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 3h6l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                  <path d="M15 3v4h4" />
                  <path d="M9 13h6" />
                  <path d="M9 17h4" />
                </svg>
                <span className="uppercase tracking-wide">Consensi & Privacy</span>
              </span>
              <svg
                className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 lg:grid-cols-[1.1fr,0.9fr]">
                      <div className="space-y-3">
                        {missingRequired.length > 0 ? (
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            {missingRequired.map((module) => (
                              <span
                                key={module.id}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700"
                              >
                                {module.name} mancante
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {patient.consents.length === 0 ? (
                          <p className="text-sm text-zinc-600">Nessun consenso registrato.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {patient.consents.map((consent) => {
                              const signatureUrl = (consent as { signatureUrl?: string | null }).signatureUrl;
                              return (
                                <div
                                  key={consent.id}
                                  className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                                >
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase text-emerald-800">
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {consent.module?.name ?? "Modulo"}
                                    </span>
                                    <span className="rounded-full bg-emerald-700 px-3 py-1 text-white">
                                      {consentStatusLabels[consent.status] ?? consent.status}
                                    </span>
                                    <span className="text-emerald-900">
                                      {new Date(consent.givenAt).toLocaleString("it-IT", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })}
                                    </span>
                                    {signatureUrl ? (
                                      <Link
                                        href={`/pazienti/${patient.id}/consensi/${consent.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-900"
                                      >
                                        Stampa
                                      </Link>
                                    ) : (
                                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-500">
                                        Firma non disponibile
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-emerald-900">
                                    Canale: {consent.channel ?? "—"}
                                    {consent.expiresAt
                                      ? ` · Scadenza: ${new Date(consent.expiresAt).toLocaleDateString("it-IT")}`
                                      : ""}
                                    {consent.revokedAt
                                      ? ` · Revocato: ${new Date(consent.revokedAt).toLocaleDateString("it-IT")}`
                                      : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <ConsentForm
                          patientId={patient.id}
                          modules={consentModules}
                          doctors={doctors}
                          consents={patient.consents.map((consent) => ({
                            id: consent.id,
                            moduleId: consent.moduleId,
                            status: consent.status,
                            channel: consent.channel,
                            givenAt: consent.givenAt,
                            signatureUrl: (consent as { signatureUrl?: string | null }).signatureUrl ?? null,
                            module: consent.module ? { name: consent.module.name } : null,
                          }))}
                          revokeAction={revokeConsent}
                        />
                        {canExport ? (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              Strumenti GDPR
                            </p>
                            <p className="mt-2 text-sm text-emerald-900">
                              Esporta o elimina i dati personali per richieste dell&apos;interessato.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {canExport ? (
                                <a
                                  href={`/api/patients/${patient.id}/export`}
                                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300"
                                >
                                  Scarica dati
                                </a>
                              ) : null}
                              {isAdmin ? <PatientDeleteButton patientId={patient.id} /> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
          </details>

          <QuoteAccordion
            patientId={patient.id}
            services={services.map((service) => ({
              id: service.id,
              name: service.name,
              costBasis: Number(service.costBasis?.toString?.() ?? service.costBasis ?? 0),
            }))}
            initialQuote={parsedQuote}
            printHref={parsedQuote?.id ? `/pazienti/${patient.id}/preventivo/${parsedQuote.id}` : null}
            className="bg-white"
            onSave={savePreventivo}
          />

          <DentalChart
            patientId={patient.id}
            initialRecords={dentalRecordsSerialized}
            containerClassName="bg-zinc-50"
          />

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
              <span className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="M22 7 12 13 2 7" />
                </svg>
                <span className="uppercase tracking-wide">Comunicazioni</span>
              </span>
              <svg
                className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="grid gap-4 p-6 lg:grid-cols-[340px,1fr]">
              <div className="space-y-3">
                <form action={sendPatientSms} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <label className="flex flex-col gap-1">
                    Template
                    <select
                      name="templateId"
                      required
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      defaultValue={smsTemplates[0]?.id ?? ""}
                    >
                      <option value="" disabled>
                        Seleziona template
                      </option>
                      {smsTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-zinc-600">
                    Placeholder supportati: {"{{nome}}, {{cognome}}, {{dottore}}, {{data_appuntamento}}, {{motivo_visita}}, {{note}}"}.
                  </p>
                  <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Invia SMS
                  </FormSubmitButton>
                </form>

                <form
                  action={sendPatientAccessEmail}
                  className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800"
                >
                  <input type="hidden" name="patientId" value={patient.id} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">Invia accesso area pazienti</p>
                    <p className="text-xs text-zinc-600">
                      Invia il link di accesso all&apos;email del paziente:{" "}
                      <span className="font-semibold">{patient.email ?? "—"}</span>
                    </p>
                  </div>
                  <FormSubmitButton
                    disabled={!patient.email}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Invia email accesso
                  </FormSubmitButton>
                </form>

                <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">Promemoria WhatsApp</p>
                    <p className="text-xs text-zinc-600">
                      Invia un promemoria al numero:{" "}
                      <span className="font-semibold">{patientPhone ?? "—"}</span>
                    </p>
                  </div>
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Invia promemoria
                    </a>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700/60 px-4 text-sm font-semibold text-white opacity-70">
                      Invia promemoria
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Log invii</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">
                    {smsLogs.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {smsLogs.length === 0 ? (
                    <p className="text-sm text-zinc-600">Nessun SMS inviato.</p>
                  ) : (
                    smsLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-900">{log.to}</span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              log.status === "SENT" || log.status === "SIMULATED"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          {log.template?.name ? `${log.template.name} · ` : ""}
                          {new Date(log.createdAt).toLocaleString("it-IT")}
                        </p>
                        <p className="text-sm text-zinc-700 line-clamp-2">{log.body}</p>
                        {log.error ? (
                          <p className="text-[11px] text-rose-600">Errore: {log.error}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </details>
        </div>

      <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-base font-semibold text-zinc-900">
          <span className="flex items-center gap-3">
            <svg
              className="h-8 w-8 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="M14 3v5h5" />
            </svg>
            <span className="uppercase tracking-wide">Associa impianti</span>
          </span>
          <svg
            className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <p className="pt-4 text-sm text-zinc-600">
          Registra impianti/protesi collegati al paziente utilizzando i dati di magazzino.
        </p>

        <div className="mt-4 space-y-4">
          <div className="relative overflow-x-auto rounded-2xl border border-zinc-200">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo di DM</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">UDI-DI</th>
                  <th className="px-3 py-2 text-left">UDI-PI</th>
                  <th className="px-3 py-2 text-left">Data acquisto</th>
                  <th className="px-3 py-2 text-left">Data intervento</th>
                  <th className="px-3 py-2 text-left">Sede intervento</th>
                  <th className="px-3 py-2 text-left">Modifica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {implants.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={8}>
                      Nessun impianto associato.
                    </td>
                  </tr>
                ) : (
                  implants.map((imp) => {
                    const note = imp.note ?? "";
                    const deviceType = note.match(/Tipo:\s*([^·]+)/)?.[1]?.trim() ?? imp.product?.name ?? "—";
                    const brandFromNote = note.match(/Marca:\s*([^·]+)/)?.[1]?.trim();
                    const udiDiFromNote = note.match(/UDI-DI:\s*([^·]+)/)?.[1]?.trim();
                    const brand =
                      brandFromNote ?? imp.product?.supplier?.name ?? (imp.product?.name ? "—" : "—");
                    return (
                      <tr key={imp.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900">{deviceType}</td>
                        <td className="px-3 py-2 text-zinc-700">{brand ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                          {udiDiFromNote ?? imp.product?.udiDi ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">{imp.udiPi ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.purchaseDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.purchaseDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.interventionDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.interventionDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{imp.interventionSite ?? "—"}</td>
                        <td className="px-3 py-2">
                          <details className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">
                            <summary className="cursor-pointer font-semibold text-emerald-800">Modifica</summary>
                            <form action={updateImplantAssociation} className="mt-2 grid grid-cols-1 gap-2">
                              <input type="hidden" name="implantId" value={imp.id} />
                              <input type="hidden" name="patientId" value={patient.id} />
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Prodotto
                                <select
                                  name="productId"
                                  defaultValue={imp.productId}
                                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Tipo DM
                                <input
                                  name="deviceType"
                                  defaultValue={deviceType !== "—" ? deviceType : ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Marca
                                <input
                                  name="brand"
                                  defaultValue={brand ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-DI
                                <input
                                  name="udiDi"
                                  defaultValue={udiDiFromNote ?? imp.product?.udiDi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  placeholder="UDI-DI"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-PI
                                <input
                                  name="udiPi"
                                  defaultValue={imp.udiPi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data acquisto
                                <input
                                  type="date"
                                  name="purchaseDate"
                                  defaultValue={
                                    imp.purchaseDate ? imp.purchaseDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data intervento
                                <input
                                  type="date"
                                  name="interventionDate"
                                  defaultValue={
                                    imp.interventionDate ? imp.interventionDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Sede
                                <input
                                  name="interventionSite"
                                  defaultValue={imp.interventionSite ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <div className="flex justify-end pt-1">
                                <button
                                  type="submit"
                                  className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                                >
                                  Salva
                                </button>
                              </div>
                            </form>
                          </details>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-200 hover:bg-emerald-50">
              <span>Dettagli impianto</span>
              <svg
                className="h-4 w-4 text-emerald-700 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <form action={addImplantAssociation} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Prodotto / Tipo di DM
                <select
                  name="productId"
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleziona prodotto
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Marca
                <input
                  name="brand"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Marca"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Tipo di DM (personalizzato)
                <input
                  name="deviceType"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. Impianto, Protesi..."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-DI
                <input
                  name="udiDi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-DI"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-PI
                <input
                  name="udiPi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-PI / Lotto"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data acquisto
                <input
                  type="date"
                  name="purchaseDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data intervento
                <input
                  type="date"
                  name="interventionDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Sede intervento
                <input
                  name="interventionSite"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. 1.1, 2.4..."
                />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <FormSubmitButton className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                  Associa impianto
                </FormSubmitButton>
              </div>
            </form>
          </details>
        </div>
      </details>
    </div>

    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Storico appuntamenti</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {pastAppointments.length}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {pastAppointments.length === 0 ? (
          <p className="py-4 text-sm text-zinc-600">Nessun appuntamento passato.</p>
        ) : (
          pastAppointments.slice(0, 5).map((appt) => (
            <div
              key={appt.id}
              className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span aria-hidden="true">
                        {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                        (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                          ? "🦷"
                          : "❤️"}
                      </span>
                      {appt.title}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      {appt.serviceType}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800">
                    🧑‍⚕️ Paziente {patient.lastName} {patient.firstName} è stato visto da{" "}
                    <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                    il{" "}
                    {new Intl.DateTimeFormat("it-IT", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(appt.startsAt)}{" "}
                    alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                  </p>
                  <p className="text-sm text-zinc-800">
                    🕒 Il servizio ha richiesto circa{" "}
                    {Math.max(
                      1,
                      Math.round(
                        (appt.endsAt.getTime() - appt.startsAt.getTime()) / (1000 * 60 * 60)
                      )
                    )}{" "}
                    ora/e.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                  >
                    {statusLabels[appt.status].toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-zinc-600">
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                    }).format(appt.startsAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </>
);
}
