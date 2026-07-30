import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const validateCronSecret = vi.fn();
  const unauthorizedCronResponse = vi.fn(
    (..._args: unknown[]) => Response.json({ error: "Unauthorized" }, { status: 401 }),
  );
  const getAutoMergeEmptyDuplicates = vi.fn();
  const mergeAllSafeEmptyShellGroups = vi.fn();
  const errorResponse = vi.fn(
    async ({ message, status = 500 }: { message: string; status?: number }) =>
      Response.json({ error: message, code: "ERR_TEST" }, { status }),
  );

  return {
    validateCronSecret,
    unauthorizedCronResponse,
    getAutoMergeEmptyDuplicates,
    mergeAllSafeEmptyShellGroups,
    errorResponse,
  };
});

vi.mock("@/lib/cron-auth", () => ({
  validateCronSecret: mocks.validateCronSecret,
  unauthorizedCronResponse: mocks.unauthorizedCronResponse,
}));

vi.mock("@/lib/practice-settings", () => ({
  getAutoMergeEmptyDuplicates: mocks.getAutoMergeEmptyDuplicates,
}));

vi.mock("@/lib/patients/duplicate-merge", () => ({
  mergeAllSafeEmptyShellGroups: mocks.mergeAllSafeEmptyShellGroups,
}));

vi.mock("@/lib/error-response", () => ({
  errorResponse: mocks.errorResponse,
}));

import { GET } from "@/app/api/patients/duplicates/auto-merge/route";

function getRequest() {
  return new Request("http://localhost/api/patients/duplicates/auto-merge", {
    method: "GET",
  });
}

describe("GET /api/patients/duplicates/auto-merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateCronSecret.mockResolvedValue(true);
  });

  it("returns unauthorized when cron secret is invalid", async () => {
    mocks.validateCronSecret.mockResolvedValue(false);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.unauthorizedCronResponse).toHaveBeenCalledWith(
      expect.any(Request),
      "patient_duplicates_auto_merge",
    );
    expect(mocks.getAutoMergeEmptyDuplicates).not.toHaveBeenCalled();
    expect(mocks.mergeAllSafeEmptyShellGroups).not.toHaveBeenCalled();
  });

  it("skips when auto-merge setting is disabled", async () => {
    mocks.getAutoMergeEmptyDuplicates.mockResolvedValue(false);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: true,
      reason: "setting_disabled",
    });
    expect(mocks.mergeAllSafeEmptyShellGroups).not.toHaveBeenCalled();
  });

  it("merges auto-eligible groups when setting is enabled", async () => {
    mocks.getAutoMergeEmptyDuplicates.mockResolvedValue(true);
    mocks.mergeAllSafeEmptyShellGroups.mockResolvedValue({
      merged: 2,
      deleted: 3,
      skipped: 1,
      errors: [],
    });

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      merged: 2,
      deleted: 3,
      skipped: 1,
      errors: [],
    });
    expect(mocks.mergeAllSafeEmptyShellGroups).toHaveBeenCalledWith({
      actor: null,
      trigger: "cron",
      autoEligibleOnly: true,
    });
  });
});
