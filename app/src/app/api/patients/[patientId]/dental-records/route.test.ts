import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const logAudit = vi.fn();
  const revalidatePath = vi.fn();
  const syncDentalRecordIntoLatestQuote = vi.fn();
  const prisma = {
    $transaction: vi.fn(),
    dentalRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    requireUser,
    logAudit,
    revalidatePath,
    syncDentalRecordIntoLatestQuote,
    prisma,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/error-reporting", () => ({
  reportError: vi.fn().mockResolvedValue("ERR_TEST"),
}));

vi.mock("@/lib/quote-sync", () => ({
  syncDentalRecordIntoLatestQuote: mocks.syncDentalRecordIntoLatestQuote,
}));

import { PATCH, POST } from "./route";

describe("dental records API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      role: Role.ADMIN,
    });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.revalidatePath.mockReturnValue(undefined);
    mocks.syncDentalRecordIntoLatestQuote.mockResolvedValue({ synced: true });
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.prisma) => unknown) => callback(mocks.prisma)
    );
    mocks.prisma.dentalRecord.findFirst.mockResolvedValue({
      id: "existing-record",
    });
    mocks.prisma.dentalRecord.create.mockResolvedValue({
      id: "new-record",
      patientId: "patient-1",
      tooth: 0,
      procedure: "Ablazione tartaro",
      notes: null,
      updatedBy: { name: "Admin", email: "admin@example.test" },
    });
    mocks.prisma.dentalRecord.findUnique.mockResolvedValue({
      id: "existing-record",
      patientId: "patient-1",
      tooth: 0,
      procedure: "Ablazione tartaro",
      notes: null,
    });
    mocks.prisma.dentalRecord.update.mockResolvedValue({
      id: "existing-record",
      patientId: "patient-1",
      tooth: 0,
      procedure: "Ablazione tartaro",
      notes: "Nota aggiornata",
      updatedBy: { name: "Admin", email: "admin@example.test" },
    });
  });

  it("creates a new record even when the patient already has a record for the same tooth", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients/patient-1/dental-records", {
        method: "POST",
        body: JSON.stringify({
          tooth: 0,
          procedure: "Ablazione tartaro",
        }),
      }),
      { params: Promise.resolve({ patientId: "patient-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.dentalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: "patient-1",
          tooth: 0,
          procedure: "Ablazione tartaro",
        }),
      })
    );
    expect(mocks.prisma.dentalRecord.update).not.toHaveBeenCalled();
  });

  it("updates an existing record only when PATCH receives its recordId", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/patients/patient-1/dental-records", {
        method: "PATCH",
        body: JSON.stringify({
          recordId: "existing-record",
          tooth: 0,
          procedure: "Ablazione tartaro",
          notes: "Nota aggiornata",
        }),
      }),
      { params: Promise.resolve({ patientId: "patient-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.dentalRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-record" },
        data: expect.objectContaining({
          tooth: 0,
          procedure: "Ablazione tartaro",
          notes: "Nota aggiornata",
          updatedById: "user-1",
        }),
      })
    );
  });
});
