import { prisma } from "@/lib/prisma";
import { sendEmailWithHtml } from "@/lib/email";
import { placeholderCatalog, previewData } from "@/lib/placeholder-data";
import { createButton, renderEmailHtml, replacePlaceholders } from "@/lib/email-template-utils";

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
    name: "welcome",
    title: "Benvenuto",
    description: "Email di benvenuto per nuovi pazienti.",
    category: "Onboarding",
    subject: "Benvenuto in {{clinicName}}",
    body:
      "Ciao {{patientName}},\n\nBenvenuto nello studio {{clinicName}}.\n\n{{customNote}}\n\n{{button}}\n\nPer maggiori informazioni visita {{websiteUrl}}.",
    buttonColor: "#059669",
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
  return prisma.emailTemplate.create({
    data: {
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

export async function sendEmailTemplate(params: {
  to: string;
  templateName: string;
  data: Record<string, string>;
  override?: { subject?: string; body?: string };
}) {
  const template = await getEmailTemplateByName(params.templateName);
  if (!template) throw new Error("Template email non trovato");

  const subjectSource = params.override?.subject ?? template.subject;
  const bodySource = params.override?.body ?? template.body;
  const subject = replacePlaceholders(subjectSource, params.data);
  const body = replacePlaceholders(bodySource, params.data);
  const html = renderEmailHtml(body, template.buttonColor ?? undefined, params.data.clinicName);

  await sendEmailWithHtml(params.to, subject, body, html);
}

export async function sendTestEmail(params: {
  to: string;
  templateName: string;
  subject?: string;
  body?: string;
  buttonColor?: string | null;
}) {
  const data = {
    ...previewData,
    button: createButton("Apri dettaglio", "https://sorrisosplendente.com", params.buttonColor ?? undefined),
  };
  await sendEmailTemplate({
    to: params.to,
    templateName: params.templateName,
    data,
    override: {
      subject: params.subject,
      body: params.body,
    },
  });
}

async function ensureDefaultTemplates() {
  await Promise.all(
    defaultEmailTemplates.map((template) =>
      prisma.emailTemplate.upsert({
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
      })
    )
  );
}
