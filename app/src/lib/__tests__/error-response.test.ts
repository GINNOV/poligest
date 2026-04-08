import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reportError: vi.fn().mockResolvedValue("ERR_123"),
}));

vi.mock("@/lib/error-reporting", () => ({
  reportError: mocks.reportError,
}));

import { errorResponse } from "@/lib/error-response";

describe("errorResponse", () => {
  it("reports the error and returns a structured JSON response", async () => {
    const response = await errorResponse({
      message: "Operazione non riuscita",
      status: 409,
      source: "patient_test",
      context: { patientId: "patient-1" },
      actor: { id: "user-1", role: "ADMIN" as never },
    });

    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Operazione non riuscita",
        source: "patient_test",
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("x-error-code")).toBe("ERR_123");
    expect(await response.json()).toEqual({
      error: "Operazione non riuscita",
      code: "ERR_123",
    });
  });
});
