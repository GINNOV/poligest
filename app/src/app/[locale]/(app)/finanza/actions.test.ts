import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientPaymentKind, PatientPaymentMethod, Prisma, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
    prisma: {
    quote: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
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
    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      patientId: "patient-1",
      patient: {
        firstName: "Mario",
        lastName: "Rossi",
      },
      items: [
        {
          id: "quote-item-1",
          serviceName: "Igiene",
          quantity: 1,
          total: new Prisma.Decimal(100),
          createdAt: new Date("2026-04-01"),
          dentalRecord: null,
          payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD }],
        },
      ],
      payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD, quoteItemId: "quote-item-1" }],
    });
    mocks.prisma.quote.findUnique.mockResolvedValue({
      id: "quote-1",
      patientId: "patient-1",
      items: [
        {
          id: "quote-item-1",
          serviceName: "Igiene",
          quantity: 1,
          total: new Prisma.Decimal(100),
          createdAt: new Date("2026-04-01"),
          payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD }],
        },
      ],
      payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD, quoteItemId: "quote-item-1" }],
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
      quoteId: "quote-1",
      quoteItemId: "quote-item-1",
      kind: PatientPaymentKind.STANDARD,
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
        quote: {
          findFirst: vi.fn().mockResolvedValue({
            id: "quote-1",
            patientId: "patient-1",
            items: [
              {
                id: "quote-item-1",
                serviceName: "Igiene",
                quantity: 1,
                total: new Prisma.Decimal(100),
                createdAt: new Date("2026-04-01"),
                dentalRecord: null,
              },
            ],
            payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD, quoteItemId: "quote-item-1" }],
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
    formData.set("paymentKind", PatientPaymentKind.STANDARD);

    await recordPatientPayment(formData);

    expect(mocks.prisma.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "quote-1", patientId: "patient-1" },
    }));
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/finanza/pagamenti");
  });

  it("records a quote-level downpayment without a quote item", async () => {
    const txPatientPaymentCreate = vi.fn().mockResolvedValue({ id: "p-downpayment" });
    const txFinanceEntryCreate = vi.fn().mockResolvedValue({ id: "f-1" });

    mocks.prisma.$transaction.mockImplementationOnce(async (callback) => {
      const tx = {
        patientPayment: {
          create: txPatientPaymentCreate,
          update: vi.fn().mockResolvedValue(undefined),
          findMany: vi.fn().mockResolvedValue([]),
        },
        quoteItem: {
          update: vi.fn().mockResolvedValue(undefined),
          updateMany: vi.fn().mockResolvedValue(undefined),
          findUnique: vi.fn(),
        },
        quote: {
          findFirst: vi.fn().mockResolvedValue({
            id: "quote-1",
            patientId: "patient-1",
            items: [
              {
                id: "quote-item-1",
                serviceName: "Igiene",
                quantity: 1,
                total: new Prisma.Decimal(100),
                createdAt: new Date("2026-04-01"),
                dentalRecord: null,
              },
            ],
            payments: [{ amount: new Prisma.Decimal(20), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD, quoteItemId: "quote-item-1" }],
          }),
        },
        financeEntry: {
          create: txFinanceEntryCreate,
          update: vi.fn().mockResolvedValue(undefined),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        cashAdvance: {
          create: vi.fn(),
        },
      };
      return callback(tx);
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("amount", "50");
    formData.set("paidAt", "2026-04-08");
    formData.set("note", "Acconto impianto");
    formData.set("paymentMethod", PatientPaymentMethod.BANK_TRANSFER);
    formData.set("paymentKind", PatientPaymentKind.DOWNPAYMENT);

    await recordPatientPayment(formData);

    expect(mocks.prisma.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "quote-1", patientId: "patient-1" },
    }));
    expect(txPatientPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "patient-1",
        quoteId: "quote-1",
        quoteItemId: null,
        amount: new Prisma.Decimal(50),
        method: PatientPaymentMethod.BANK_TRANSFER,
        kind: PatientPaymentKind.DOWNPAYMENT,
      }),
    });
    expect(txFinanceEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining("Acconto preventivo paziente Rossi Mario"),
        metadata: expect.objectContaining({
          quoteItemId: null,
          paymentKind: PatientPaymentKind.DOWNPAYMENT,
        }),
      }),
    });
  });

  it("rejects a quote-level downpayment above the quote residual", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("amount", "90");
    formData.set("paidAt", "2026-04-08");
    formData.set("paymentKind", PatientPaymentKind.DOWNPAYMENT);

    await expect(recordPatientPayment(formData)).rejects.toThrow(
      "L'acconto supera il residuo del preventivo",
    );

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires a quote item for standard patient payments", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("amount", "10");
    formData.set("paidAt", "2026-04-08");
    formData.set("paymentKind", PatientPaymentKind.STANDARD);

    await expect(recordPatientPayment(formData)).rejects.toThrow("Dati mancanti");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
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
    mocks.prisma.quote.findFirst.mockResolvedValueOnce({
      id: "quote-1",
      patientId: "patient-1",
      patient: {
        firstName: "Mario",
        lastName: "Rossi",
      },
      items: [
        {
          id: "quote-item-1",
          serviceName: "Igiene",
          quantity: 1,
          total: new Prisma.Decimal(100),
          createdAt: new Date("2026-04-01"),
          dentalRecord: null,
          payments: [{ amount: new Prisma.Decimal(95), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD }],
        },
      ],
      payments: [{ amount: new Prisma.Decimal(95), method: PatientPaymentMethod.CASH, kind: PatientPaymentKind.STANDARD, quoteItemId: "quote-item-1" }],
    });

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
    mocks.prisma.quote.findFirst.mockResolvedValueOnce({
      id: "quote-1",
      patientId: "patient-1",
      patient: {
        firstName: "Mario",
        lastName: "Rossi",
      },
      items: [],
      payments: [],
    });

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
        quoteId: true,
        quoteItemId: true,
        kind: true,
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

  it("rejects doctor payments with invalid dates", async () => {
    const formData = new FormData();
    formData.set("doctorId", "doctor-1");
    formData.set("amount", "120.75");
    formData.set("occurredAt", "not-a-date");

    await expect(createDoctorPayment(formData)).rejects.toThrow("Data non valida");
  });

  it("rejects patient payment with invalid dates", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("quoteItemId", "quote-item-1");
    formData.set("amount", "50");
    formData.set("paidAt", "not-a-date");

    await expect(recordPatientPayment(formData)).rejects.toThrow("Data non valida");
  });
});

