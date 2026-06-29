import { Resend } from "resend";
import { APP_BRAND_NAME } from "@/lib/brand";

const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_TOKEN;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function resolveEmailFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL || "noreply@sorrisosplendente.com";
  if (/<[^>]+>/.test(configured)) {
    return configured;
  }

  const displayName = process.env.RESEND_FROM_NAME || APP_BRAND_NAME;
  return `${displayName} <${configured}>`;
}

const defaultFrom = resolveEmailFromAddress();

export type EmailDeliveryOptions = {
  bcc?: string | string[];
};

async function deliverEmail(
  to: string,
  subject: string,
  body: string,
  html: string,
  options?: EmailDeliveryOptions,
) {
  if (!resend) {
    throw new Error("Provider email non configurato (RESEND_API_KEY/RESEND_TOKEN).");
  }

  const result = await resend.emails.send({
    from: defaultFrom,
    to,
    subject,
    text: body,
    html,
    ...(options?.bcc ? { bcc: options.bcc } : {}),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? "unknown error"}`);
  }

  return result;
}

export async function sendEmail(to: string, subject: string, body: string) {
  return deliverEmail(to, subject, body, `<p>${body}</p>`);
}

export async function sendEmailWithHtml(
  to: string,
  subject: string,
  body: string,
  html: string,
  options?: EmailDeliveryOptions,
) {
  return deliverEmail(to, subject, body, html, options);
}
