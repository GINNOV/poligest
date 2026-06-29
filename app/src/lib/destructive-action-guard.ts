const BULK_DESTRUCTIVE_DISABLE_FLAG = "DISABLE_BULK_DESTRUCTIVE_ACTIONS";

export const DELETE_CONFIRMATION_TEXT = "ELIMINA";
export const IMPORT_CONFIRMATION_TEXT = "IMPORTA DATI";
export const RESET_CONFIRMATION_TEXT = "Si, confermo";

type EnvLike = Record<string, string | undefined>;

export function isBulkDestructiveActionEnabled(env: EnvLike = process.env) {
  if (env.NODE_ENV === "test") return true;
  return env[BULK_DESTRUCTIVE_DISABLE_FLAG] !== "true";
}

export function assertBulkDestructiveActionEnabled(env: EnvLike = process.env) {
  if (!isBulkDestructiveActionEnabled(env)) {
    throw new Error("Operazione bloccata. Il ripristino e il reset del database sono temporaneamente disabilitati.");
  }
}

export function hasTypedConfirmation(value: string | null | undefined, expected: string) {
  return value?.trim() === expected;
}

export function parseDeleteConfirmationHeaders(headers: Headers) {
  return {
    intent: headers.get("x-destructive-intent"),
    resourceId: headers.get("x-confirm-resource-id"),
    confirmation: headers.get("x-delete-confirmation"),
  };
}

export function isConfirmedDeleteRequest(
  headers: Headers,
  resourceId: string,
  expectedConfirmation = DELETE_CONFIRMATION_TEXT,
) {
  const confirmation = parseDeleteConfirmationHeaders(headers);
  return (
    confirmation.intent === "delete" &&
    confirmation.resourceId === resourceId &&
    confirmation.confirmation === expectedConfirmation
  );
}