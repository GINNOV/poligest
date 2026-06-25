import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  quote: { findMany: vi.fn(), deleteMany: vi.fn() },
  patientPayment: { deleteMany: vi.fn() },
  quoteItem: { deleteMany: vi.fn() },
  appointmentReminder: { deleteMany: vi.fn() },
  appointment: { deleteMany: vi.fn() },
  clinicalNote: { deleteMany: vi.fn() },
  dentalRecord: { deleteMany: vi.fn() },
  recall: { deleteMany: vi.fn() },
  recurringMessageLog: { deleteMany: vi.fn() },
  stockMovement: { deleteMany: vi.fn() },
  patientConsent: { deleteMany: vi.fn() },
  smsLog: { deleteMany: vi.fn() },
  cashAdvance: { deleteMany: vi.fn() },
  financeEntry: { deleteMany: vi.fn() },
  patient: { delete: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks,
}));

import { deletePatientWithRelations } from "@/lib/patients/delete-patient";

describe("deletePatientWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quote.findMany.mockResolvedValue([{ id: "quote-1" }]);
    for (const model of Object.values(mocks)) {
      if ("deleteMany" in model) {
        model.deleteMany.mockResolvedValue({ count: 0 });
      }
    }
    mocks.patient.delete.mockResolvedValue({ id: "patient-1" });
  });

  it("removes dependent records before deleting the patient", async () => {
    await deletePatientWithRelations("patient-1");

    expect(mocks.appointmentReminder.deleteMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
    });
    expect(mocks.quoteItem.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: { in: ["quote-1"] } },
    });
    expect(mocks.patient.delete).toHaveBeenCalledWith({
      where: { id: "patient-1" },
    });
  });

  it("skips quote cleanup when the patient has no quotes", async () => {
    mocks.quote.findMany.mockResolvedValue([]);

    await deletePatientWithRelations("patient-2");

    expect(mocks.quoteItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.quote.deleteMany).not.toHaveBeenCalled();
    expect(mocks.patientPayment.deleteMany).toHaveBeenCalledWith({
      where: { patientId: "patient-2" },
    });
  });
});