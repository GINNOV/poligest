import type { JsonObject } from "@/lib/json-types";

export type ErrorMetadataView = {
  code?: string;
  message?: string;
  source?: string;
  path?: string;
  context?: JsonObject;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    digest?: string;
    statusCode?: number;
    humanReadableMessage?: string;
  };
};

export type NormalizedErrorRecord = {
  id: string;
  supportCode: string;
  codeKind: "support" | "next_digest" | "audit_id";
  codeKindLabel: string;
  areaLabel: string;
  areaDescription: string;
  message: string;
  source: string | null;
  path: string | null;
  errorMessage: string | null;
  errorHuman: string | null;
  errorName: string | null;
  errorDigest: string | null;
  errorStack: string | null;
  actor: string | null;
  role: string | null;
  createdAt: string;
  context: JsonObject | null;
};

const SOURCE_LABELS: Record<string, string> = {
  fetch: "Navigazione / richieste API",
  global_error_boundary: "Crash pagina (Next.js)",
  client: "Browser / interfaccia",
  daily_reminder: "Promemoria quotidiano",
  "admin.user.invite": "Invito utenti",
  "admin.user.reset_link": "Reset accesso utente",
};

function isSupportErrorCode(code: string) {
  return /^ERR-[A-Z0-9]+-[A-Z0-9]+$/i.test(code);
}

function isNextDigest(code: string) {
  return /^\d{6,}$/.test(code);
}

export function getErrorSourceLabel(source: string | null | undefined) {
  if (!source) return "Origine non specificata";
  return SOURCE_LABELS[source] ?? source;
}

export function resolveErrorArea(source: string | null | undefined, path: string | null | undefined) {
  const sourceLabel = getErrorSourceLabel(source);
  if (path) {
    if (path.startsWith("/api/")) {
      return {
        label: "API",
        description: `${sourceLabel} · ${path}`,
      };
    }
    if (path.startsWith("/admin")) {
      return {
        label: "Amministrazione",
        description: `${sourceLabel} · ${path}`,
      };
    }
    if (path.startsWith("/pazienti") || path.includes("patient")) {
      return {
        label: "Pazienti",
        description: `${sourceLabel} · ${path}`,
      };
    }
    return {
      label: "Applicazione",
      description: `${sourceLabel} · ${path}`,
    };
  }

  if (source === "fetch") {
    return { label: "Navigazione", description: sourceLabel };
  }
  if (source === "global_error_boundary") {
    return { label: "Crash pagina", description: sourceLabel };
  }
  if (source === "daily_reminder") {
    return { label: "Promemoria quotidiano", description: sourceLabel };
  }

  return { label: "Sistema", description: sourceLabel };
}

export function classifyErrorCode(params: {
  supportCode: string;
  source?: string | null;
  digest?: string | null;
}): Pick<NormalizedErrorRecord, "codeKind" | "codeKindLabel"> {
  if (isSupportErrorCode(params.supportCode)) {
    return {
      codeKind: "support",
      codeKindLabel: "Codice supporto app",
    };
  }

  if (
    params.source === "global_error_boundary" ||
    isNextDigest(params.supportCode) ||
    (params.digest && params.digest === params.supportCode)
  ) {
    return {
      codeKind: "next_digest",
      codeKindLabel: "Digest Next.js",
    };
  }

  return {
    codeKind: "audit_id",
    codeKindLabel: "ID registro",
  };
}

export function normalizeErrorLog(params: {
  id: string;
  entityId: string | null;
  metadata: ErrorMetadataView | null;
  actor: string | null;
  role: string | null;
  createdAt: Date;
}): NormalizedErrorRecord {
  const meta = params.metadata;
  const supportCode = meta?.code ?? params.entityId ?? params.id;
  const area = resolveErrorArea(meta?.source ?? null, meta?.path ?? null);
  const classification = classifyErrorCode({
    supportCode,
    source: meta?.source,
    digest: meta?.error?.digest ?? null,
  });

  const errorHuman =
    meta?.error?.humanReadableMessage ??
    (meta?.error?.message && meta.error.message !== "[object Object]" ? meta.error.message : null);

  return {
    id: params.id,
    supportCode,
    ...classification,
    areaLabel: area.label,
    areaDescription: area.description,
    message: meta?.message ?? "Errore non specificato",
    source: meta?.source ?? null,
    path: meta?.path ?? null,
    errorMessage: meta?.error?.message ?? null,
    errorHuman,
    errorName: meta?.error?.name ?? null,
    errorDigest: meta?.error?.digest ?? null,
    errorStack: meta?.error?.stack ?? null,
    actor: params.actor,
    role: params.role,
    createdAt: params.createdAt.toISOString(),
    context: meta?.context ?? null,
  };
}

export function formatErrorRecordForCopy(entry: NormalizedErrorRecord) {
  const lines = [
    `${entry.codeKindLabel}: ${entry.supportCode}`,
    `Area: ${entry.areaLabel}`,
    `Origine: ${entry.areaDescription}`,
    `Messaggio: ${entry.message}`,
  ];

  if (entry.errorHuman) lines.push(`Dettaglio: ${entry.errorHuman}`);
  else if (entry.errorMessage) lines.push(`Dettaglio tecnico: ${entry.errorMessage}`);
  if (entry.errorName) lines.push(`Tipo: ${entry.errorName}`);
  if (entry.errorDigest && entry.errorDigest !== entry.supportCode) {
    lines.push(`Digest Next.js: ${entry.errorDigest}`);
  }
  if (entry.path) lines.push(`Percorso: ${entry.path}`);
  if (entry.context) {
    try {
      lines.push(`Contesto: ${JSON.stringify(entry.context)}`);
    } catch {
      lines.push(`Contesto: ${String(entry.context)}`);
    }
  }
  if (entry.actor) lines.push(`Utente: ${entry.actor}${entry.role ? ` (${entry.role})` : ""}`);
  lines.push(
    `Data: ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}`,
  );
  lines.push(`ID registro: ${entry.id}`);

  return lines.join("\n");
}

export const ERROR_CODE_HELP = {
  support:
    "Codici ERR-... generati dall'app per API, navigazione e operazioni server. Usali con il supporto e nei toast.",
  nextDigest:
    "Numeri lunghi generati da Next.js quando una pagina va in crash. Coincidono con il codice mostrato nella schermata di errore.",
  auditId: "ID interno del registro audit, usato solo se manca un codice supporto esplicito.",
} as const;