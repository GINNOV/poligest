import { logAudit } from "@/lib/audit";
import { Prisma, Role } from "@prisma/client";

type Actor = {
  id: string;
  role: Role;
};

type ErrorReport = {
  code?: string;
  message: string;
  source?: string;
  path?: string;
  context?: Prisma.InputJsonValue;
  error?: unknown;
  actor?: Actor | null;
};

const createErrorCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ERR-${stamp}-${rand}`;
};

const safeStringify = (value: unknown) => {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const serializeError = (error: unknown): Record<string, unknown> | null => {
  if (!error) return null;
  if (error instanceof Error) {
    const extended = error as Error & {
      digest?: string;
      cause?: unknown;
      statusCode?: number;
      humanReadableMessage?: string;
      details?: unknown;
    };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: extended.digest,
      statusCode: extended.statusCode,
      humanReadableMessage: extended.humanReadableMessage,
      details: extended.details,
      cause: extended.cause ? serializeError(extended.cause) : undefined,
    };
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      message:
        typeof record.message === "string"
          ? record.message
          : record.message !== undefined
            ? safeStringify(record.message)
            : safeStringify(error),
      stack: typeof record.stack === "string" ? record.stack : undefined,
      digest: typeof record.digest === "string" ? record.digest : undefined,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
      humanReadableMessage:
        typeof record.humanReadableMessage === "string"
          ? record.humanReadableMessage
          : typeof record.human_readable_message === "string"
            ? record.human_readable_message
            : undefined,
      details: record.details ?? record.extraData ?? undefined,
      cause: record.cause ? serializeError(record.cause) : undefined,
    };
  }
  return { message: String(error) };
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(record)) {
      result[key] = toJsonValue(entry);
    }
    return result;
  }
  return String(value);
};

export async function reportError({
  code,
  message,
  source,
  path,
  context,
  error,
  actor,
}: ErrorReport) {
  const errorCode = code ?? createErrorCode();
  await logAudit(actor ?? null, {
    action: "error.reported",
    entity: "System",
    entityId: errorCode,
    metadata: {
      code: errorCode,
      message,
      source,
      path,
      context: context ? toJsonValue(context) : undefined,
      error: error ? toJsonValue(serializeError(error)) : undefined,
    },
  });

  console.error("App error reported", { code: errorCode, message, source, path, error });
  return errorCode;
}
