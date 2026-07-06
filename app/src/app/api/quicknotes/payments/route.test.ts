import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientPaymentKind, PatientPaymentMethod, Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const txPatientPaymentCreate = vi.fn();
  const txFinanceEntryCreate = vi.fn();

  const prisma = {
    patient: {
      findUnique: vi.fn(),
    },
    financeEntry: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    logAudit: vi.fn(),
    revalidatePath: vi.fn(),
    prisma,
    txPatientPaymentCreate,
    txFinanceEntryCreate,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST } from "./route";

function quickNotesRequest(body: Record<string, unknown>, token = "test_secret_token") {
  return new Request("http://localhost/api/quicknotes/payments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  patientId: "patient-1",
  quickNotesTransactionId: "quicknotes-tx-1",
  amount: 120.5,
  paidAt: "2026-07-05T10:00:00.000Z",
  method: "CASH",
  clientName: "Mario Rossi",
  note: "Registrato da QuickNotes",
};

describe("POST /api/quicknotes/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";

    mocks.prisma.patient.findUnique.mockResolvedValue({
      id: "patient-1",
      firstName: "Mario",
      lastName: "Rossi",
    });
    mocks.prisma.financeEntry.findFirst.mockResolvedValue(null);
    mocks.txPatientPaymentCreate.mockResolvedValue({ id: "payment-1" });
    mocks.txFinanceEntryCreate.mockResolvedValue({ id: "finance-1" });
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        patientPayment: { create: mocks.txPatientPaymentCreate },
        financeEntry: { create: mocks.txFinanceEntryCreate },
      }),
    );
    mocks.logAudit.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects unauthorized requests before reading or writing finance data", async () => {
    const response = await POST(
      new Request("http://localhost/api/quicknotes/payments", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.prisma.patient.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads before opening a transaction", async () => {
    const response = await POST(quickNotesRequest({ ...validPayload, amount: "0" }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.patient.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not write anything when the patient id is unknown", async () => {
    mocks.prisma.patient.findUnique.mockResolvedValue(null);

    const response = await POST(quickNotesRequest(validPayload));

    expect(response.status).toBe(404);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.txPatientPaymentCreate).not.toHaveBeenCalled();
    expect(mocks.txFinanceEntryCreate).not.toHaveBeenCalled();
  });

  it("returns the existing finance record for duplicate QuickNotes transactions without writing again", async () => {
    mocks.prisma.financeEntry.findFirst.mockResolvedValue({
      id: "finance-existing",
      metadata: {
        paymentId: "payment-existing",
      },
    });

    const response = await POST(quickNotesRequest(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: true,
      paymentId: "payment-existing",
      financeEntryId: "finance-existing",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.txPatientPaymentCreate).not.toHaveBeenCalled();
    expect(mocks.txFinanceEntryCreate).not.toHaveBeenCalled();
  });

  it("creates the patient payment and finance entry inside the same transaction", async () => {
    const response = await POST(quickNotesRequest(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: false,
      paymentId: "payment-1",
      financeEntryId: "finance-1",
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.txPatientPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "patient-1",
        amount: new Prisma.Decimal(120.5),
        method: PatientPaymentMethod.CASH,
        kind: PatientPaymentKind.STANDARD,
        note: "Registrato da QuickNotes",
      }),
    });
    expect(mocks.txFinanceEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "INCOME",
        amount: new Prisma.Decimal(120.5),
        patientId: "patient-1",
        method: PatientPaymentMethod.CASH,
        metadata: {
          source: "quicknotes",
          quickNotesTransactionId: "quicknotes-tx-1",
          paymentId: "payment-1",
          clientName: "Mario Rossi",
        },
      }),
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(null, expect.objectContaining({
      action: "finance.quicknotes_payment.recorded",
      entityId: "payment-1",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/pagamenti");
  });

  it("does not report success or run side effects when the atomic database transaction fails", async () => {
    mocks.prisma.$transaction.mockRejectedValue(new Error("transaction rolled back"));

    const response = await POST(quickNotesRequest(validPayload));

    expect(response.status).toBe(500);
    expect(mocks.logAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("still returns success when non-critical audit logging fails after the transaction commits", async () => {
    mocks.logAudit.mockRejectedValue(new Error("audit down"));

    const response = await POST(quickNotesRequest(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      paymentId: "payment-1",
      financeEntryId: "finance-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/pagamenti");
  });
});
