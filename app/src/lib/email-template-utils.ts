export function replacePlaceholders(text: string, data: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    if (key in data) return data[key];
    return match;
  });
}

export function renderEmailHtml(body: string, buttonColor?: string, clinicName?: string) {
  const footerName = clinicName || "Sorriso Splendente";
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
