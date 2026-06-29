import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailWithHtml } from "@/lib/email";
import { placeholderCatalog, previewData } from "@/lib/placeholder-data";
import {
  buildTransactionalButton,
  bodyContainsButtonPlaceholder,
  materializeTransactionalEmail,
  resolveTransactionalSiteOrigin,
} from "@/lib/email-template-utils";

export type EmailTemplateSeed = {
  name: string;
  title: string;
  description: string;
  category: string;
  subject: string;
  body: string;
  buttonColor?: string;
};

export const defaultEmailTemplates: EmailTemplateSeed[] = [
  {
    name: "welcome-staff",
    title: "Benvenuto staff",
    description: "Email di benvenuto per nuovi membri dello staff.",
    category: "Onboarding",
    subject: "Benvenuto nello staff di {{clinicName}}",
    body:
      "Ciao!\n\nBenvenuto nello staff di {{clinicName}}. Il tuo ruolo è {{staffRole}}.\n\nRiceverai a breve un'email con un codice monouso per accedere.\n\n{{customNote}}",
    buttonColor: "#047857",
  },
  {
    name: "welcome-patient",
    title: "Benvenuto paziente",
    description: "Email di benvenuto per nuovi pazienti.",
    category: "Onboarding",
    subject: "Benvenuto in {{clinicName}}",
    body:
      "Gentile {{patientName}},\n\nLa informiamo che l'accesso alla Sua area paziente è stato attivato.\n\nAttraverso il link qui sotto potrà visualizzare e gestire i Suoi appuntamenti:\n\n{{button}}\n\nPer assistenza contatti la segreteria.\n\nCordiali saluti,\n{{clinicName}}",
    buttonColor: "#047857",
  },
  {
    name: "appointment-reminder",
    title: "Promemoria appuntamento",
    description: "Promemoria per appuntamenti programmati.",
    category: "Promemoria",
    subject: "Promemoria appuntamento {{appointmentDate}}",
    body:
      "Ciao {{patientName}},\n\nTi ricordiamo il tuo appuntamento il {{appointmentDate}} alle {{appointmentTime}} con {{doctorName}}.\n\n{{button}}\n\nA presto,\n{{clinicName}}.",
    buttonColor: "#0f766e",
  },
  {
    name: "follow-up",
    title: "Follow-up",
    description: "Messaggio di follow-up dopo la visita.",
    category: "Post-visita",
    subject: "Come è andata la visita?",
    body:
      "Ciao {{patientName}},\n\nGrazie per la visita presso {{clinicName}}.\nSe hai bisogno di altro supporto, rispondi a questa email.\n\n{{customNote}}\n\n{{button}}",
    buttonColor: "#1d4ed8",
  },
  {
    name: "invoice-ready",
    title: "Fattura pronta",
    description: "Avviso che la fattura è disponibile.",
    category: "Billing",
    subject: "La tua fattura è disponibile",
    body:
      "Ciao {{patientName}},\n\nLa tua fattura è pronta.\n\n{{button}}\n\nGrazie,\n{{clinicName}}.",
    buttonColor: "#16a34a",
  },
];

export const placeholderKeys = placeholderCatalog.map((item) => item.key);

export async function getAllEmailTemplates() {
  await ensureDefaultTemplates();
  return prisma.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function getEmailTemplateByName(name: string) {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!normalized) return null;
  await ensureDefaultTemplates();
  let template = await prisma.emailTemplate.findUnique({ where: { name: normalized } });
  if (!template) {
    template = await prisma.emailTemplate.findUnique({ where: { id: normalized } });
  }
  if (!template) {
    template = await prisma.emailTemplate.findFirst({
      where: { name: { equals: normalized, mode: "insensitive" } },
    });
  }
  if (template) return template;
  const fallback = defaultEmailTemplates.find((t) => t.name === name);
  if (!fallback) return null;
  return prisma.emailTemplate.upsert({
    where: { name: fallback.name },
    update: {
      category: fallback.category,
      description: fallback.description,
    },
    create: {
      name: fallback.name,
      subject: fallback.subject,
      body: fallback.body,
      buttonColor: fallback.buttonColor,
      category: fallback.category,
      description: fallback.description,
    },
  });
}

export async function updateEmailTemplate(params: {
  name: string;
  subject: string;
  body: string;
  buttonColor?: string | null;
}) {
  await ensureDefaultTemplates();
  return prisma.emailTemplate.update({
    where: { name: params.name },
    data: {
      subject: params.subject,
      body: params.body,
      buttonColor: params.buttonColor || null,
    },
  });
}

function withButtonPlaceholder(
  data: Record<string, string>,
  bodySource: string,
  buttonColor?: string | null,
): Record<string, string> {
  if (!bodyContainsButtonPlaceholder(bodySource)) {
    return { ...data, button: "" };
  }

  return {
    ...data,
    button: buildTransactionalButton(
      buttonColor,
      data.buttonLabel || "Apri dettaglio",
      data.websiteUrl || resolveTransactionalSiteOrigin(),
    ),
  };
}

export async function sendEmailTemplate(params: {
  to: string;
  templateName: string;
  data: Record<string, string>;
  override?: { subject?: string; body?: string; buttonColor?: string | null };
}) {
  const template = await getEmailTemplateByName(params.templateName);
  if (!template) throw new Error("Template email non trovato");

  const subjectSource = params.override?.subject ?? template.subject;
  const bodySource = params.override?.body ?? template.body;
  const buttonColor = params.override?.buttonColor ?? template.buttonColor;
  const data = withButtonPlaceholder(params.data, bodySource, buttonColor);
  const materialized = materializeTransactionalEmail({
    subjectSource,
    bodySource,
    data,
    buttonColor,
    clinicName: params.data.clinicName,
    templateName: params.templateName,
  });

  await sendEmailWithHtml(
    params.to,
    materialized.subject,
    materialized.body,
    materialized.html,
  );
}

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertValidRecipientEmail(to: string) {
  const normalized = to.trim();
  if (!EMAIL_ADDRESS_PATTERN.test(normalized)) {
    throw new Error("Inserisci un indirizzo email valido per il test.");
  }
  return normalized;
}

export async function sendTestEmail(params: {
  to: string;
  templateName: string;
  subject?: string;
  body?: string;
  buttonColor?: string | null;
}) {
  const to = assertValidRecipientEmail(params.to);
  const template = await getEmailTemplateByName(params.templateName);
  const bodySource = params.body ?? template?.body ?? "";
  const buttonColor = params.buttonColor ?? template?.buttonColor ?? null;
  const data = withButtonPlaceholder(
    {
      ...previewData,
      websiteUrl: previewData.websiteUrl || resolveTransactionalSiteOrigin(),
    },
    bodySource,
    buttonColor,
  );

  await sendEmailTemplate({
    to,
    templateName: params.templateName,
    data,
    override: {
      subject: params.subject,
      body: params.body,
      buttonColor,
    },
  });
}

async function migrateLegacyWelcomeTemplate() {
  const legacy = await prisma.emailTemplate.findUnique({ where: { name: "welcome" } });
  const patient = await prisma.emailTemplate.findUnique({ where: { name: "welcome-patient" } });
  if (!legacy || patient) return;

  await prisma.emailTemplate.upsert({
    where: { name: "welcome-patient" },
    update: {
      category: "Onboarding",
      description: "Email di benvenuto per nuovi pazienti.",
    },
    create: {
      name: "welcome-patient",
      subject: legacy.subject,
      body: legacy.body,
      buttonColor: legacy.buttonColor,
      category: "Onboarding",
      description: "Email di benvenuto per nuovi pazienti.",
    },
  });
}

let ensureDefaultTemplatesPromise: Promise<void> | null = null;

async function upsertDefaultTemplate(template: EmailTemplateSeed) {
  try {
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: {
        category: template.category,
        description: template.description,
      },
      create: {
        name: template.name,
        subject: template.subject,
        body: template.body,
        buttonColor: template.buttonColor,
        category: template.category,
        description: template.description,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

async function ensureDefaultTemplatesOnce() {
  await migrateLegacyWelcomeTemplate();
  await Promise.all(defaultEmailTemplates.map((template) => upsertDefaultTemplate(template)));
}

async function ensureDefaultTemplates() {
  ensureDefaultTemplatesPromise ??= ensureDefaultTemplatesOnce().catch((error) => {
    ensureDefaultTemplatesPromise = null;
    throw error;
  });
  await ensureDefaultTemplatesPromise;
}
