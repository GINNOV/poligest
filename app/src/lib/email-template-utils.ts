import { APP_BRAND_NAME } from "@/lib/brand";

const PUBLIC_SITE_ORIGIN = "https://sorrisosplendente.com";

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) return "";
  if (/^https?:\/\//.test(rawOrigin)) return rawOrigin.replace(/\/$/, "");
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function isPublicSiteOrigin(origin: string) {
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    return !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveTransactionalSiteOrigin() {
  const configuredOrigin = normalizeSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
  );

  if (isPublicSiteOrigin(configuredOrigin)) {
    return configuredOrigin;
  }

  return PUBLIC_SITE_ORIGIN;
}

export function replacePlaceholders(text: string, data: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    if (key in data) return data[key];
    return match;
  });
}

export function bodyContainsButtonPlaceholder(body: string) {
  return /\{\{\s*button\s*\}\}/.test(body);
}

export function plainTextFromEmailBody(body: string) {
  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildTransactionalButton(
  buttonColor?: string | null,
  label = "Apri dettaglio",
  url?: string,
) {
  const targetUrl = url ?? resolveTransactionalSiteOrigin();
  return createButton(label, targetUrl, buttonColor ?? undefined);
}

export function materializeTransactionalEmail(params: {
  subjectSource: string;
  bodySource: string;
  data: Record<string, string>;
  buttonColor?: string | null;
  clinicName?: string;
}) {
  const subject = replacePlaceholders(params.subjectSource, params.data);
  const htmlBody = replacePlaceholders(params.bodySource, params.data);
  const clinicName = params.clinicName ?? params.data.clinicName;
  const html = renderEmailHtml(htmlBody, params.buttonColor ?? undefined, clinicName);
  const body = plainTextFromEmailBody(htmlBody);

  return { subject, body, html };
}

export function renderEmailHtml(body: string, buttonColor?: string, clinicName?: string) {
  const footerName = clinicName || APP_BRAND_NAME;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="width:600px;max-width:92%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:32px;">
                <div style="font-size:14px;line-height:1.6;color:#374151;white-space:pre-line;">${body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                Questo messaggio è stato inviato da ${footerName}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function createButton(label: string, url: string, buttonColor?: string) {
  const color = buttonColor || "#059669";
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">${label}</a>`;
}
