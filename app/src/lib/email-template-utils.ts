import { APP_BRAND_NAME } from "@/lib/brand";
import {
  buildReportEmailHeader,
  escapeReportHtml,
  wrapReportEmailBody,
} from "@/lib/report-email-layout";

const PUBLIC_SITE_ORIGIN = "https://sorrisosplendente.com";

export type TransactionalEmailHeader = {
  badge?: string;
  title?: string;
  subtitle?: string;
  intro?: string;
};

const TRANSACTIONAL_EMAIL_HEADERS: Record<string, Pick<TransactionalEmailHeader, "badge" | "subtitle">> = {
  "welcome-patient": { badge: "Benvenuto", subtitle: "Area paziente" },
  "welcome-staff": { badge: "Benvenuto", subtitle: "Nuovo membro dello staff" },
  "appointment-reminder": { badge: "Promemoria", subtitle: "Appuntamento" },
  "follow-up": { badge: "Post-visita", subtitle: "Follow-up" },
  "invoice-ready": { badge: "Fatturazione", subtitle: "Documento disponibile" },
};

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

function containsHtmlMarkup(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

export function formatTransactionalBodyHtml(body: string) {
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (containsHtmlMarkup(block)) {
        if (/<a\s/i.test(block)) {
          return `<div style="text-align:center;margin:24px 0;">${block}</div>`;
        }

        return `<div style="margin:0 0 16px;font-size:15px;line-height:22px;color:#3f3f46;">${block}</div>`;
      }

      const lines = block.split("\n").map(escapeReportHtml).join("<br />");
      return `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#3f3f46;">${lines}</p>`;
    })
    .join("\n");
}

export function resolveTransactionalEmailHeader(params: {
  templateName?: string;
  clinicName?: string;
  header?: TransactionalEmailHeader;
}): Required<Pick<TransactionalEmailHeader, "badge" | "title" | "subtitle">> &
  Pick<TransactionalEmailHeader, "intro"> {
  const clinicName = params.clinicName?.trim() || APP_BRAND_NAME;
  const preset = params.templateName ? TRANSACTIONAL_EMAIL_HEADERS[params.templateName] : undefined;

  return {
    badge: params.header?.badge ?? preset?.badge ?? APP_BRAND_NAME,
    title: params.header?.title ?? clinicName,
    subtitle: params.header?.subtitle ?? preset?.subtitle ?? "Messaggio dallo studio",
    intro: params.header?.intro,
  };
}

export function materializeTransactionalEmail(params: {
  subjectSource: string;
  bodySource: string;
  data: Record<string, string>;
  buttonColor?: string | null;
  clinicName?: string;
  templateName?: string;
  header?: TransactionalEmailHeader;
}) {
  const subject = replacePlaceholders(params.subjectSource, params.data);
  const htmlBody = replacePlaceholders(params.bodySource, params.data);
  const clinicName = params.clinicName ?? params.data.clinicName;
  const html = renderEmailHtml(htmlBody, {
    clinicName,
    templateName: params.templateName,
    header: params.header,
  });
  const body = plainTextFromEmailBody(htmlBody);

  return { subject, body, html };
}

export function renderEmailHtml(
  body: string,
  options?: {
    buttonColor?: string;
    clinicName?: string;
    templateName?: string;
    header?: TransactionalEmailHeader;
  },
) {
  const clinicName = options?.clinicName;
  const footerName = clinicName?.trim() || APP_BRAND_NAME;
  const header = resolveTransactionalEmailHeader({
    templateName: options?.templateName,
    clinicName,
    header: options?.header,
  });
  const formattedBody = formatTransactionalBodyHtml(body);

  return wrapReportEmailBody(`
    ${buildReportEmailHeader(header)}
    <div style="padding:28px;">
      ${formattedBody}
    </div>
    <div style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0;font-size:12px;line-height:18px;color:#71717a;">
        Questo messaggio è stato inviato da ${escapeReportHtml(footerName)} tramite ${escapeReportHtml(APP_BRAND_NAME)}.
      </p>
    </div>
  `);
}

export function createButton(label: string, url: string, buttonColor?: string) {
  const color = buttonColor || "#059669";
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">${label}</a>`;
}