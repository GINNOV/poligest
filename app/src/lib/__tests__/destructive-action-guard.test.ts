import { describe, expect, it } from "vitest";
import {
  DELETE_CONFIRMATION_TEXT,
  assertBulkDestructiveActionEnabled,
  hasTypedConfirmation,
  isBulkDestructiveActionEnabled,
  isConfirmedDeleteRequest,
} from "@/lib/destructive-action-guard";

describe("destructive action guard", () => {
  it("requires the env flag outside test mode", () => {
    expect(isBulkDestructiveActionEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(() => assertBulkDestructiveActionEnabled({ NODE_ENV: "production" })).toThrow(
      "ALLOW_BULK_DESTRUCTIVE_ACTIONS=true",
    );
  });

  it("allows destructive actions in tests or when explicitly enabled", () => {
    expect(isBulkDestructiveActionEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isBulkDestructiveActionEnabled({ NODE_ENV: "production", ALLOW_BULK_DESTRUCTIVE_ACTIONS: "true" })).toBe(true);
  });

  it("validates typed confirmation phrases", () => {
    expect(hasTypedConfirmation(" ELIMINA ", DELETE_CONFIRMATION_TEXT)).toBe(true);
    expect(hasTypedConfirmation("NO", DELETE_CONFIRMATION_TEXT)).toBe(false);
  });

  it("requires matching delete confirmation headers", () => {
    const headers = new Headers({
      "x-destructive-intent": "delete",
      "x-confirm-resource-id": "patient-1",
      "x-delete-confirmation": DELETE_CONFIRMATION_TEXT,
    });

    expect(isConfirmedDeleteRequest(headers, "patient-1")).toBe(true);
    expect(isConfirmedDeleteRequest(headers, "patient-2")).toBe(false);
  });
});
