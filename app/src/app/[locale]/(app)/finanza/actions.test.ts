import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientPaymentMethod, Prisma, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  getOptionalPrismaModel: vi.fn(),
  prisma: {
    quoteItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    financeEntry: {
      create: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    cashAdvance: {
      create: vi.fn(),
    },
    doctor: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma-models", () => ({
  getOptionalPrismaModel: mocks.getOptionalPrismaModel,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  createCashAdvance,
  createDoctorPayment,
  recordExpense,
  recordPatientPayment,
} from "@/app/[locale]/(app)/finanza/actions";

describe("finanza actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
    mocks.prisma.quoteItem.findFirst.mockResolvedValue({
      id: "quote-item-1",
      serviceName: "Igiene",
      total: new Prisma.Decimal(100),
      saldato: false,
      quote: {
        patient: {
          firstName: "Mario",
          lastName: "Rossi",
        },
      },
    });
    mocks.prisma.supplier.findUnique.mockResolvedValue({ name: "Dental Supply" });
    mocks.prisma.product.findUnique.mockResolvedValue({ name: "Impianto" });
    mocks.prisma.doctor.findUnique.mockResolvedValue({ fullName: "Dr. Verdi" });
    mocks.prisma.financeEntry.create.mockResolvedValue(undefined);
    mocks.prisma.cashAdvance.create.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.update.mockResolvedValue(undefined);

    mocks.getOptionalPrismaModel.mockReturnValue({
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ amount: new Prisma.Decimal(20) }]),
    });

    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        patientPayment: {
          create: vi.fn().mockResolvedValue(undefined),
        },
        quoteItem: {
          update: vi.fn().mockResolvedValue(undefined),
        },
        financeEntry: {
          create: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });
  });

  it("records a patient payment, updates settlement state, and writes a finance entry", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("quoteItemId", "quote-item-1");
    formData.set("amount", "80");
    formData.set("paidAt", "2026-04-08");
    formData.set("note", "Saldo finale");
    formData.set("paymentMethod", PatientPaymentMethod.CASH);

    await recordPatientPayment(formData);

    expect(mocks.prisma.quoteItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: "quote-item-1",
        quoteId: "quote-1",
        quote: { patientId: "patient-1" },
      },
      include: {
        quote: {
          select: {
            patient: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/pagamenti");
  });

  it("rejects patient payment when the amount exceeds the quote item residual", async () => {
    const patientPaymentModel = {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ amount: new Prisma.Decimal(95) }]),
    };
    mocks.getOptionalPrismaModel.mockReturnValue(patientPaymentModel);

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("quoteItemId", "quote-item-1");
    formData.set("amount", "10");
    formData.set("paidAt", "2026-04-08");

    await expect(recordPatientPayment(formData)).rejects.toThrow(
      "L'importo supera il residuo della prestazione selezionata",
    );

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects patient payment when the quote item is missing", async () => {
    mocks.prisma.quoteItem.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("quoteItemId", "quote-item-1");
    formData.set("amount", "10");
    formData.set("paidAt", "2026-04-08");

    await expect(recordPatientPayment(formData)).rejects.toThrow(
      "Prestazione del preventivo non trovata",
    );
  });

  it("records an expense with supplier and product context", async () => {
    const formData = new FormData();
    formData.set("expenseDescription", "Ordine mensile");
    formData.set("supplierId", "supplier-1");
    formData.set("productId", "product-1");
    formData.set("expenseKind", "material");
    formData.set("paymentType", "cash");
    formData.set("purchaseDate", "2026-04-08");
    formData.set("expenseAmount", "55.50");
    formData.set("expenseNote", "Urgente");

    await recordExpense(formData);

    expect(mocks.prisma.financeEntry.create).toHaveBeenCalledWith({
      data: {
        type: "EXPENSE",
        description: "Spesa materiale · Ordine mensile · Fornitore: Dental Supply · Materiale: Impianto · Pagamento: contanti · Urgente",
        amount: "55.50",
        occurredAt: new Date("2026-04-08"),
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
  });

  it("creates a cash advance and revalidates finance views", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("amount", "150");
    formData.set("issuedAt", "2026-04-08");
    formData.set("note", "Acconto");

    await createCashAdvance(formData);

    expect(mocks.prisma.cashAdvance.create).toHaveBeenCalledWith({
      data: {
        patientId: "patient-1",
        amount: "150",
        issuedAt: new Date("2026-04-08"),
        note: "Acconto",
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/anticipi");
  });

  it("creates a doctor payment entry and validates the doctor exists", async () => {
    const formData = new FormData();
    formData.set("doctorId", "doctor-1");
    formData.set("amount", "120.75");
    formData.set("occurredAt", "2026-04-08");
    formData.set("note", "Saldo aprile");

    await createDoctorPayment(formData);

    expect(mocks.prisma.financeEntry.create).toHaveBeenCalledWith({
      data: {
        type: "EXPENSE",
        description: "Pagamento medico · Saldo aprile",
        amount: new Prisma.Decimal(120.75),
        occurredAt: new Date("2026-04-08"),
        doctorId: "doctor-1",
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/anticipi");
  });

  it("rejects doctor payments for unknown doctors", async () => {
    mocks.prisma.doctor.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("doctorId", "missing-doctor");
    formData.set("amount", "120.75");
    formData.set("occurredAt", "2026-04-08");

    await expect(createDoctorPayment(formData)).rejects.toThrow("Medico non trovato");
  });
});
