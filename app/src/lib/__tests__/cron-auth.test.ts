import { describe, expect, it, vi } from "vitest";
import { unauthorizedCronResponse, validateCronSecret } from "@/lib/cron-auth";

vi.mock("@/lib/error-response", () => ({
  errorResponse: vi.fn(),
}));

describe("cron auth", () => {
  it("accepts bearer or custom cron secrets", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    await expect(
      validateCronSecret(new Request("https://example.test/api/job", {
        headers: { authorization: "Bearer secret" },
      })),
    ).resolves.toBe(true);
    await expect(
      validateCronSecret(new Request("https://example.test/api/job", {
        headers: { "x-cron-secret": "secret" },
      })),
    ).resolves.toBe(true);
    await expect(validateCronSecret(new Request("https://example.test/api/job"))).resolves.toBe(false);

    vi.unstubAllEnvs();
  });

  it("does not report unauthorized cron probes as application errors", async () => {
    const { errorResponse } = await import("@/lib/error-response");
    const response = unauthorizedCronResponse();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(errorResponse).not.toHaveBeenCalled();
  });
});
