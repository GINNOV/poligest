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

export function resolveReportSiteOrigin() {
  const configuredOrigin = normalizeSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
  );

  if (isPublicSiteOrigin(configuredOrigin)) {
    return configuredOrigin;
  }

  return PUBLIC_SITE_ORIGIN;
}

export function escapeReportHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildReportKpiCard(
  label: string,
  value: string,
  detail: string,
  options?: {
    background?: string;
    borderColor?: string;
    labelColor?: string;
    valueColor?: string;
    detailColor?: string;
  },
) {
  const background = options?.background ?? "#fafafa";
  const borderColor = options?.borderColor ?? "#e4e4e7";
  const labelColor = options?.labelColor ?? "#71717a";
  const valueColor = options?.valueColor ?? "#18181b";
  const detailColor = options?.detailColor ?? "#52525b";

  return `
    <td style="padding:8px;vertical-align:top;">
      <div style="border:1px solid ${borderColor};border-radius:16px;padding:16px;background:${background};">
        <div style="font-size:12px;line-height:16px;color:${labelColor};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">${escapeReportHtml(label)}</div>
        <div style="margin-top:10px;font-size:28px;line-height:32px;color:${valueColor};font-weight:700;">${escapeReportHtml(value)}</div>
        <div style="margin-top:8px;font-size:13px;line-height:18px;color:${detailColor};">${escapeReportHtml(detail)}</div>
      </div>
    </td>
  `;
}

export function buildReportEmailHeader(options: {
  badge: string;
  title: string;
  subtitle: string;
  intro?: string;
}) {
  const siteOrigin = resolveReportSiteOrigin();
  const logoUrl = siteOrigin ? `${siteOrigin}/logo/studio_agovinoangrisano_logo.png` : "";

  return `
    <div style="padding:28px 28px 20px;background:#ffffff;border-bottom:1px solid #e4e4e7;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                ${
                  logoUrl
                    ? `<td style="vertical-align:middle;padding-right:16px;">
                        <div style="height:56px;width:160px;border-radius:12px;background:#ffffff;padding:8px;box-sizing:border-box;">
                          <img src="${escapeReportHtml(logoUrl)}" alt="Logo Studio Agovino &amp; Angrisano" width="144" height="40" style="display:block;height:40px;width:144px;object-fit:contain;" />
                        </div>
                      </td>`
                    : ""
                }
                <td style="vertical-align:middle;">
                  <div style="font-size:12px;line-height:16px;color:#047857;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">${escapeReportHtml(options.badge)}</div>
                  <div style="margin-top:6px;font-size:30px;line-height:36px;color:#18181b;font-weight:700;">${escapeReportHtml(options.title)}</div>
                  <div style="margin-top:6px;font-size:13px;line-height:18px;color:#71717a;">${escapeReportHtml(options.subtitle)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      ${
        options.intro
          ? `<p style="margin:18px 0 0;font-size:15px;line-height:22px;color:#52525b;">${escapeReportHtml(options.intro)}</p>`
          : ""
      }
    </div>
  `;
}

export function wrapReportEmailBody(innerHtml: string) {
  return `
    <div style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
      <div style="max-width:880px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden;">
        ${innerHtml}
      </div>
    </div>
  `;
}