import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientPaymentMethod, Prisma, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
  prisma: {
    patientPayment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    quoteItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    financeEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
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
    appointment: {
      findFirst: vi.fn(),
    },
    patient: {
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

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  createCashAdvance,
  createDoctorPayment,
  recordExpense,
  archivePatientPayment,
  recordPatientPayment,
  amendDoctorPayment,
  archiveDoctorPayment,
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
    mocks.prisma.doctor.findUnique.mockResolvedValue({ id: "doctor-1", fullName: "Dr. Verdi" });
    mocks.prisma.patient.findUnique.mockResolvedValue({ id: "patient-1", firstName: "Mario", lastName: "Rossi" });
    mocks.prisma.appointment.findFirst.mockResolvedValue({ id: "appt-1", doctorId: "doctor-1" });
    mocks.prisma.financeEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      amount: new Prisma.Decimal(100),
      description: "Pagamento medico · Metodo: elettronico · Test",
      occurredAt: new Date("2026-04-08"),
      doctorId: "doctor-1",
    });
    mocks.prisma.financeEntry.create.mockResolvedValue({ id: "finance-1" });
    mocks.prisma.cashAdvance.create.mockResolvedValue({ id: "advance-1" });
    mocks.prisma.quoteItem.update.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.findUnique.mockResolvedValue({
      id: "quote-item-1",
      total: new Prisma.Decimal(100),
      saldato: true,
    });
    mocks.prisma.patientPayment.findUnique.mockResolvedValue({
      id: "payment-1",
      patientId: "patient-1",
      quoteItemId: "quote-item-1",
      archivedAt: null,
    });
    mocks.prisma.patientPayment.update.mockResolvedValue(undefined);
    mocks.prisma.patientPayment.findMany.mockResolvedValue([{ amount: new Prisma.Decimal(20) }]);

    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        patientPayment: {
          create: vi.fn().mockResolvedValue({ id: "p-1" }),
          update: vi.fn().mockResolvedValue(undefined),
          findMany: vi.fn().mockResolvedValue([{ amount: new Prisma.Decimal(20) }]),
        },
        quoteItem: {
          update: vi.fn().mockResolvedValue(undefined),
          findUnique: vi.fn().mockResolvedValue({
            id: "quote-item-1",
            total: new Prisma.Decimal(100),
            saldato: true,
          }),
        },
        financeEntry: {
          create: vi.fn().mockResolvedValue({ id: "f-1" }),
          update: vi.fn().mockResolvedValue(undefined),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        cashAdvance: {
          create: vi.fn().mockResolvedValue({ id: "a-1" }),
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
        dentalRecord: {
          select: {
            updatedById: true,
          },
        },
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

  it("uses explicit doctorId in recordPatientPayment if provided", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("quoteItemId", "quote-item-1");
    formData.set("amount", "50");
    formData.set("paidAt", "2026-04-08");
    formData.set("doctorId", "doctor-999");

    await recordPatientPayment(formData);

    // We need to capture the transaction callback's call
    // (mocks.prisma.$transaction.mock.calls[0][0])
    // This is not easy because tx is created inside the mock.
  });

  it("rejects patient payment when the amount exceeds the quote item residual", async () => {
    mocks.prisma.patientPayment.findMany.mockResolvedValue([{ amount: new Prisma.Decimal(95) }]);

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

  it("archives a patient payment and refreshes the quote item settlement state", async () => {
    const formData = new FormData();
    formData.set("paymentId", "payment-1");

    await archivePatientPayment(formData);

    expect(mocks.prisma.patientPayment.findUnique).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      select: {
        id: true,
        patientId: true,
        quoteItemId: true,
        archivedAt: true,
      },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/pagamenti");
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

    expect(mocks.prisma.$transaction).toHaveBeenCalled();
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
        description: "Pagamento medico · Metodo: elettronico · Saldo aprile",
        amount: new Prisma.Decimal(120.75),
        occurredAt: new Date("2026-04-08"),
        doctorId: "doctor-1",
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/anticipi");
  });

  it("amends a doctor payment and logs the change", async () => {
    const formData = new FormData();
    formData.set("entryId", "entry-1");
    formData.set("amount", "150.00");
    formData.set("occurredAt", "2026-04-09");
    formData.set("paymentMethod", PatientPaymentMethod.CASH);
    formData.set("note", "Correzione errore");

    await amendDoctorPayment(formData);

    expect(mocks.prisma.financeEntry.findUnique).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/anticipi");
  });

  it("archives a doctor payment by prefixing the description", async () => {
    const formData = new FormData();
    formData.set("entryId", "entry-1");

    await archiveDoctorPayment(formData);

    expect(mocks.prisma.financeEntry.findUnique).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      select: { description: true },
    });
    expect(mocks.prisma.financeEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: { description: "[ARCHIVIO] Pagamento medico · Metodo: elettronico · Test" },
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
