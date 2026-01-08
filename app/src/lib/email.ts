import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_TOKEN;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultFrom = process.env.RESEND_FROM_EMAIL || "noreply@sorrisosplendente.com";

export async function sendEmail(to: string, subject: string, body: string) {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing RESEND_API_KEY/RESEND_TOKEN; cannot send email.");
    }
    console.warn("Missing RESEND_API_KEY/RESEND_TOKEN; skipping email send.");
    return null;
  }

  const html = `<p>${body}</p>`;

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
