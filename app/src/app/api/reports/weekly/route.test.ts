import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  errorResponse: vi.fn(async ({ message, status = 500 }: { message: string; status?: number }) =>
    Response.json({ error: message, code: "ERR_WEEKLY" }, { status })),
  sendPracticeWeeklyReport: vi.fn(),
  getPracticeTimeZone: vi.fn(async () => "Europe/Rome"),
}));

vi.mock("@/lib/error-response", () => ({
  errorResponse: mocks.errorResponse,
}));

vi.mock("@/lib/practice-weekly-report", () => ({
  sendPracticeWeeklyReport: mocks.sendPracticeWeeklyReport,
}));

vi.mock("@/lib/practice-settings", () => ({
  getPracticeTimeZone: mocks.getPracticeTimeZone,
}));

import { GET, runtime } from "@/app/api/reports/weekly/route";

describe("GET /api/reports/weekly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "top-secret");
    mocks.sendPracticeWeeklyReport.mockResolvedValue({ sent: true, skipped: false });
  });

  it("keeps the route on the node runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("rejects requests with a missing or invalid cron secret", async () => {
    const response = await GET(new Request("http://localhost/api/reports/weekly"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.errorResponse).not.toHaveBeenCalled();
  });

  it("runs the weekly report with parsed force mode", async () => {
    const response = await GET(
      new Request("http://localhost/api/reports/weekly?force=1", {
        headers: { "x-cron-secret": "top-secret" },
      }),
    );

    expect(mocks.sendPracticeWeeklyReport).toHaveBeenCalledWith({
      force: true,
      trigger: "CRON",
      timeZone: "Europe/Rome",
    });
    expect(await response.json()).toEqual({ sent: true, skipped: false });
  });

  it("returns a structured error when the report send fails", async () => {
    mocks.sendPracticeWeeklyReport.mockRejectedValue(new Error("smtp down"));

    const response = await GET(
      new Request("http://localhost/api/reports/weekly", {
        headers: { "x-cron-secret": "top-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Errore invio report settimanale",
      code: "ERR_WEEKLY",
    });
  });
});
