import { logAudit } from "@/lib/audit";
import { isJsonObject } from "@/lib/json-types";
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

const serializeError = (error: unknown): Prisma.InputJsonObject | null => {
  if (!error) return null;
  if (error instanceof Error) {
    const extended = error as Error & {
      digest?: string;
      cause?: unknown;
      statusCode?: number;
      humanReadableMessage?: string;
      details?: unknown;
    };
    const serialized: Record<string, Prisma.InputJsonValue> = {
      name: error.name,
      message: error.message,
    };
    if (typeof error.stack === "string") serialized.stack = error.stack;
    if (typeof extended.digest === "string") serialized.digest = extended.digest;
    if (typeof extended.statusCode === "number") serialized.statusCode = extended.statusCode;
    if (typeof extended.humanReadableMessage === "string") {
      serialized.humanReadableMessage = extended.humanReadableMessage;
    }
    if (extended.details !== undefined) serialized.details = toJsonValue(extended.details);
    const cause = extended.cause ? serializeError(extended.cause) : null;
    if (cause) serialized.cause = cause;
    return serialized;
  }
  if (isJsonObject(error)) {
    const record = error;
    const serialized: Record<string, Prisma.InputJsonValue> = {
      message:
        typeof record.message === "string"
          ? record.message
          : record.message !== undefined
            ? safeStringify(record.message)
            : safeStringify(error),
    };
    if (typeof record.name === "string") serialized.name = record.name;
    if (typeof record.stack === "string") serialized.stack = record.stack;
    if (typeof record.digest === "string") serialized.digest = record.digest;
    if (typeof record.statusCode === "number") serialized.statusCode = record.statusCode;
    if (typeof record.humanReadableMessage === "string") {
      serialized.humanReadableMessage = record.humanReadableMessage;
    } else if (typeof record.human_readable_message === "string") {
      serialized.humanReadableMessage = record.human_readable_message;
    }
    if (record.details !== undefined) {
      serialized.details = toJsonValue(record.details);
    } else if (record.extraData !== undefined) {
      serialized.details = toJsonValue(record.extraData);
    }
    const cause = record.cause ? serializeError(record.cause) : null;
    if (cause) serialized.cause = cause;
    return serialized;
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
  if (isJsonObject(value)) {
    const record = value;
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
