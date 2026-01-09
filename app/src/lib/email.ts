import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_TOKEN;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultFrom = process.env.RESEND_FROM_EMAIL || "noreply@sorrisosplendente.com";

async function deliverEmail(to: string, subject: string, body: string, html: string) {
  if (!resend) {
    throw new Error("Provider email non configurato (RESEND_API_KEY/RESEND_TOKEN).");
  }

  const result = await resend.emails.send({
    from: defaultFrom,
    to,
    subject,
    text: body,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? "unknown error"}`);
  }

  return result;
}

export async function sendEmail(to: string, subject: string, body: string) {
  return deliverEmail(to, subject, body, `<p>${body}</p>`);
}

export async function sendEmailWithHtml(to: string, subject: string, body: string, html: string) {
  return deliverEmail(to, subject, body, html);
}
