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

const serializeError = (error: unknown) => {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
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
