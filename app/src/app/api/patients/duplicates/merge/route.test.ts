import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const revalidatePath = vi.fn();
  const mergeEmptyDuplicateShells = vi.fn();
  const mergeAllSafeEmptyShellGroups = vi.fn();
  const errorResponse = vi.fn(
    async ({ message, status = 500 }: { message: string; status?: number }) =>
      Response.json({ error: message, code: "ERR_TEST" }, { status }),
  );

  return {
    requireUser,
    revalidatePath,
    mergeEmptyDuplicateShells,
    mergeAllSafeEmptyShellGroups,
    errorResponse,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/error-response", () => ({
  errorResponse: mocks.errorResponse,
}));

vi.mock("@/lib/patients/duplicate-merge", () => ({
  mergeEmptyDuplicateShells: mocks.mergeEmptyDuplicateShells,
  mergeAllSafeEmptyShellGroups: mocks.mergeAllSafeEmptyShellGroups,
}));

import { POST } from "@/app/api/patients/duplicates/merge/route";

const adminUser = { id: "admin-1", role: Role.ADMIN };

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/patients/duplicates/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/patients/duplicates/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue(adminUser);
  });

  it("requires ADMIN auth", async () => {
    await postJson({ confirmation: DELETE_CONFIRMATION_TEXT, mode: "safe_all" });
    expect(mocks.requireUser).toHaveBeenCalledWith([Role.ADMIN]);
  });

  it("returns 400 without typed confirmation", async () => {
    const response = await postJson({
      keepPatientId: "keep-1",
      deletePatientIds: ["del-1"],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Digita ${DELETE_CONFIRMATION_TEXT} per confermare`,
      code: "ERR_TEST",
    });
    expect(mocks.mergeEmptyDuplicateShells).not.toHaveBeenCalled();
    expect(mocks.mergeAllSafeEmptyShellGroups).not.toHaveBeenCalled();
  });

  it("merges a single empty-shell group on success", async () => {
    mocks.mergeEmptyDuplicateShells.mockResolvedValue({
      ok: true,
      keepPatientId: "keep-1",
      deletedPatientIds: ["del-1"],
      filledFields: ["email"],
    });

    const response = await postJson({
      keepPatientId: "keep-1",
      deletePatientIds: ["del-1"],
      confirmation: DELETE_CONFIRMATION_TEXT,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mode: "single",
      ok: true,
      keepPatientId: "keep-1",
      deletedPatientIds: ["del-1"],
      filledFields: ["email"],
    });
    expect(mocks.mergeEmptyDuplicateShells).toHaveBeenCalledWith({
      keepPatientId: "keep-1",
      deletePatientIds: ["del-1"],
      actor: adminUser,
      trigger: "ui",
    });
    expect(mocks.mergeAllSafeEmptyShellGroups).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/duplicati");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/keep-1");
  });

  it("returns merge failure as errorResponse", async () => {
    mocks.mergeEmptyDuplicateShells.mockResolvedValue({
      ok: false,
      error: "Patient del-1 is not an empty shell and cannot be deleted by merge",
      code: "NOT_EMPTY",
    });

    const response = await postJson({
      keepPatientId: "keep-1",
      deletePatientIds: ["del-1"],
      confirmation: DELETE_CONFIRMATION_TEXT,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Patient del-1 is not an empty shell and cannot be deleted by merge",
      code: "ERR_TEST",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("bulk safe_all mode calls mergeAllSafeEmptyShellGroups", async () => {
    mocks.mergeAllSafeEmptyShellGroups.mockResolvedValue({
      merged: 2,
      deleted: 3,
      skipped: 1,
      errors: [],
    });

    const response = await postJson({
      mode: "safe_all",
      confirmation: DELETE_CONFIRMATION_TEXT,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mode: "safe_all",
      ok: true,
      merged: 2,
      deleted: 3,
      skipped: 1,
      errors: [],
    });
    expect(mocks.mergeAllSafeEmptyShellGroups).toHaveBeenCalledWith({
      actor: adminUser,
      trigger: "bulk",
      autoEligibleOnly: false,
    });
    expect(mocks.mergeEmptyDuplicateShells).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/duplicati");
  });
});
