import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE_CONFIRMATION_TEXT } from "@/lib/destructive-action-guard";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const logAudit = vi.fn();
  const revalidatePath = vi.fn();
  const errorResponse = vi.fn(
    async ({ message, status = 500 }: { message: string; status?: number }) =>
      Response.json({ error: message, code: "ERR_TEST" }, { status }),
  );
  const prisma = {
    patient: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    quote: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    quoteItem: {
      deleteMany: vi.fn(),
    },
    appointmentReminder: {
      deleteMany: vi.fn(),
    },
    dentalRecord: {
      deleteMany: vi.fn(),
    },
    clinicalNote: {
      deleteMany: vi.fn(),
    },
    recall: {
      deleteMany: vi.fn(),
    },
    recurringMessageLog: {
      deleteMany: vi.fn(),
    },
    appointment: {
      deleteMany: vi.fn(),
    },
    stockMovement: {
      deleteMany: vi.fn(),
    },
    patientConsent: {
      deleteMany: vi.fn(),
    },
    smsLog: {
      deleteMany: vi.fn(),
    },
    cashAdvance: {
      deleteMany: vi.fn(),
    },
    patientPayment: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    requireUser,
    logAudit,
    revalidatePath,
    errorResponse,
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

vi.mock("@/lib/error-response", () => ({
  errorResponse: mocks.errorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { DELETE } from "@/app/api/patients/[patientId]/route";

describe("DELETE /api/patients/[patientId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.prisma.patient.findUnique.mockResolvedValue({ id: "patient-1" });
    mocks.prisma.quote.findMany.mockResolvedValue([{ id: "quote-1" }]);
    mocks.prisma.$transaction.mockResolvedValue(undefined);

    for (const model of [
      mocks.prisma.appointmentReminder,
      mocks.prisma.dentalRecord,
      mocks.prisma.clinicalNote,
      mocks.prisma.recall,
      mocks.prisma.recurringMessageLog,
      mocks.prisma.appointment,
      mocks.prisma.stockMovement,
      mocks.prisma.patientConsent,
      mocks.prisma.smsLog,
      mocks.prisma.cashAdvance,
      mocks.prisma.patientPayment,
      mocks.prisma.quoteItem,
      mocks.prisma.quote,
      mocks.prisma.patient,
    ]) {
      if ("deleteMany" in model) {
        model.deleteMany.mockReturnValue({} as never);
      }
    }

    mocks.prisma.patient.delete.mockReturnValue({} as never);
  });

  it("rejects delete requests without typed confirmation", async () => {
    const response = await DELETE(new Request("http://localhost/api/patients/patient-1", { method: "DELETE" }), {
      params: Promise.resolve({ patientId: "patient-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Conferma eliminazione mancante. Digita '${DELETE_CONFIRMATION_TEXT}' per procedere.`,
      code: "ERR_TEST",
    });
    expect(mocks.errorResponse).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns not found when the patient does not exist", async () => {
    mocks.prisma.patient.findUnique.mockResolvedValue(null);

    const headers = new Headers({
      "x-destructive-intent": "delete",
      "x-confirm-resource-id": "patient-1",
      "x-delete-confirmation": DELETE_CONFIRMATION_TEXT,
    });

    const response = await DELETE(new Request("http://localhost/api/patients/patient-1", { method: "DELETE", headers }), {
      params: Promise.resolve({ patientId: "patient-1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Paziente non trovato",
      code: "ERR_TEST",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes the patient and related records when confirmation is valid", async () => {
    const headers = new Headers({
      "x-destructive-intent": "delete",
      "x-confirm-resource-id": "patient-1",
      "x-delete-confirmation": DELETE_CONFIRMATION_TEXT,
    });

    const response = await DELETE(new Request("http://localhost/api/patients/patient-1", { method: "DELETE", headers }), {
      params: Promise.resolve({ patientId: "patient-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.prisma.quote.findMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
      select: { id: true },
    });
    expect(mocks.prisma.quoteItem.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: { in: ["quote-1"] } },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.logAudit).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti");
  });
});
