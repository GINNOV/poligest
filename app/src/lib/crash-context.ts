export const CRASH_CONTEXT_STORAGE_KEY = "app:crash-context";
export const MAX_CRASH_EVENTS = 20;

export type CrashBreadcrumb = {
  type: "pageview" | "click" | "submit" | "network" | "visibility";
  at: string;
  path?: string;
  detail: string;
};

export type CrashContextSnapshot = {
  capturedAt: string;
  href?: string;
  referrer?: string;
  userAgent?: string;
  online?: boolean;
  breadcrumbs: CrashBreadcrumb[];
};

export function trimCrashBreadcrumbs(
  breadcrumbs: CrashBreadcrumb[],
  limit = MAX_CRASH_EVENTS,
): CrashBreadcrumb[] {
  return breadcrumbs.slice(Math.max(0, breadcrumbs.length - limit));
}

export function serializeCrashContext(snapshot: CrashContextSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    breadcrumbs: trimCrashBreadcrumbs(snapshot.breadcrumbs),
  });
}

export function parseCrashContext(raw: string | null | undefined): CrashContextSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CrashContextSnapshot>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.breadcrumbs)) {
      return null;
    }

    const breadcrumbs = parsed.breadcrumbs
      .filter(
        (entry): entry is CrashBreadcrumb =>
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.type === "string" &&
          typeof entry.at === "string" &&
          typeof entry.detail === "string",
      )
      .map((entry) => ({
        type: entry.type,
        at: entry.at,
        detail: entry.detail,
        ...(typeof entry.path === "string" ? { path: entry.path } : {}),
      }));

    return {
      capturedAt:
        typeof parsed.capturedAt === "string" ? parsed.capturedAt : new Date().toISOString(),
      ...(typeof parsed.href === "string" ? { href: parsed.href } : {}),
      ...(typeof parsed.referrer === "string" ? { referrer: parsed.referrer } : {}),
      ...(typeof parsed.userAgent === "string" ? { userAgent: parsed.userAgent } : {}),
      ...(typeof parsed.online === "boolean" ? { online: parsed.online } : {}),
      breadcrumbs: trimCrashBreadcrumbs(breadcrumbs),
    };
  } catch {
    return null;
  }
}

export function buildCrashSupportEmail(params: {
  supportEmail: string;
  errorCode: string;
  pagePath?: string;
  snapshot?: CrashContextSnapshot | null;
}) {
  const { supportEmail, errorCode, pagePath, snapshot } = params;
  const subject = `Segnalazione errore ${errorCode}`;
  const lines = [
    "Buongiorno,",
    "",
    "si è verificato un errore nell'applicazione.",
    "",
    `Codice errore: ${errorCode}`,
    `Pagina: ${pagePath || snapshot?.href || "non disponibile"}`,
    `Data segnalazione: ${new Date().toLocaleString("it-IT")}`,
    snapshot?.referrer ? `Pagina precedente: ${snapshot.referrer}` : null,
    typeof snapshot?.online === "boolean"
      ? `Connessione rilevata dal browser: ${snapshot.online ? "online" : "offline"}`
      : null,
    snapshot?.userAgent ? `Browser: ${snapshot.userAgent}` : null,
    "",
    "Passaggi recenti rilevati:",
    ...(snapshot?.breadcrumbs.length
      ? snapshot.breadcrumbs.map(
          (entry) =>
            `- ${entry.at}${entry.path ? ` | ${entry.path}` : ""} | ${entry.type}: ${entry.detail}`,
        )
      : ["- Nessun passaggio registrato"]),
    "",
    "Descrizione aggiuntiva del problema:",
    "",
  ].filter(Boolean);

  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join("\n"),
  )}`;
}

