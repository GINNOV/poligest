"use server";

import { revalidatePath } from "next/cache";
import { PatientPaymentMethod, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel } from "@/lib/prisma-models";

export async function recordPatientPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = (formData.get("patientId") as string) || "";
  const quoteId = (formData.get("quoteId") as string) || "";
  const quoteItemId = (formData.get("quoteItemId") as string) || "";
  const amountRaw = (formData.get("amount") as string)?.trim();
  const paidAt = (formData.get("paidAt") as string) || "";
  const note = ((formData.get("note") as string) || "").trim() || null;
  const methodRaw = ((formData.get("paymentMethod") as string) || PatientPaymentMethod.ELECTRONIC).toUpperCase();
  const method = Object.values(PatientPaymentMethod).includes(methodRaw as PatientPaymentMethod)
    ? (methodRaw as PatientPaymentMethod)
    : PatientPaymentMethod.ELECTRONIC;

  if (!patientId || !quoteId || !quoteItemId || !amountRaw || !paidAt) {
    throw new Error("Dati mancanti");
  }

  const amountNumber = Number.parseFloat(amountRaw.replace(",", "."));
  if (Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error("Importo non valido");
  }

  const patientPaymentClient = getOptionalPrismaModel<{
    create?: unknown;
    findMany?: (args: {
      where: { quoteItemId: string; archivedAt?: null };
      select: { amount: true };
    }) => Promise<Array<{ amount: { toString(): string } }>>;
  }>("patientPayment");

  if (!patientPaymentClient?.create) {
    throw new Error("Il modulo pagamenti non è ancora disponibile nel server attivo. Aggiorna la pagina o riavvia il server.");
  }

  const quoteItem = await prisma.quoteItem.findFirst({
    where: {
      id: quoteItemId,
      quoteId,
      quote: { patientId },
    },
    include: {
      quote: {
        select: {
          patient: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!quoteItem) {
    throw new Error("Prestazione del preventivo non trovata");
  }

  const existingPayments = patientPaymentClient.findMany
    ? await patientPaymentClient.findMany({
        where: { quoteItemId, archivedAt: null },
        select: { amount: true },
      })
    : [];

  const totalAmount = Number(quoteItem.total.toString());
  const existingPaid = existingPayments.length
    ? existingPayments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0)
    : quoteItem.saldato
      ? totalAmount
      : 0;
  const nextPaid = existingPaid + amountNumber;

  if (nextPaid - totalAmount > 0.009) {
    throw new Error("L'importo supera il residuo della prestazione selezionata");
  }

  const patientName =
    `${quoteItem.quote.patient.lastName ?? ""} ${quoteItem.quote.patient.firstName ?? ""}`.trim() || "Paziente";
  const methodLabel =
    method === PatientPaymentMethod.CASH
      ? "contanti"
      : method === PatientPaymentMethod.BANK_TRANSFER
        ? "bonifico"
        : method === PatientPaymentMethod.PAY_LATER
          ? "pagherò"
        : method === PatientPaymentMethod.OTHER
          ? "altro"
          : "elettronico";

  await prisma.$transaction(async (tx) => {
    const txWithPayments = tx as typeof tx & {
      patientPayment: {
        create: (args: {
          data: {
            patientId: string;
            quoteId: string;
            quoteItemId: string;
            amount: Prisma.Decimal;
            paidAt: Date;
            method: PatientPaymentMethod;
            note: string | null;
            userId: string;
          };
        }) => Promise<unknown>;
      };
    };

    await txWithPayments.patientPayment.create({
      data: {
        patientId,
        quoteId,
        quoteItemId,
        amount: new Prisma.Decimal(amountNumber),
        paidAt: new Date(paidAt),
        method,
        note,
        userId: user.id,
      },
    });

    await tx.quoteItem.update({
      where: { id: quoteItemId },
      data: {
        saldato: Math.abs(nextPaid - totalAmount) < 0.01 || nextPaid > totalAmount,
      },
    });

    await tx.financeEntry.create({
      data: {
        type: "INCOME",
        description: [
          `Pagamento paziente ${patientName}`,
          quoteItem.serviceName,
          `Metodo: ${methodLabel}`,
          note,
        ]
          .filter(Boolean)
          .join(" · "),
        amount: new Prisma.Decimal(amountNumber),
        occurredAt: new Date(paidAt),
        userId: user.id,
      },
    });
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/pagamenti");
}

export async function archivePatientPayment(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const paymentId = (formData.get("paymentId") as string) || "";

  if (!paymentId) {
    throw new Error("Pagamento non valido");
  }

  const payment = await prisma.patientPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      patientId: true,
      quoteItemId: true,
      archivedAt: true,
    },
  });

  if (!payment) {
    throw new Error("Pagamento non trovato");
  }

  if (payment.archivedAt) {
    revalidatePath("/finanza");
    revalidatePath("/finanza/pagamenti");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.patientPayment.update({
      where: { id: payment.id },
      data: { archivedAt: new Date() },
    });

    if (payment.quoteItemId) {
      const [quoteItem, activePayments] = await Promise.all([
        tx.quoteItem.findUnique({
          where: { id: payment.quoteItemId },
          select: { id: true, total: true, saldato: true },
        }),
        tx.patientPayment.findMany({
          where: {
            quoteItemId: payment.quoteItemId,
            archivedAt: null,
          },
          select: { amount: true },
        }),
      ]);

      if (quoteItem) {
        const paidAmount = activePayments.reduce((sum, entry) => sum + Number(entry.amount.toString()), 0);
        const totalAmount = Number(quoteItem.total.toString());

        await tx.quoteItem.update({
          where: { id: quoteItem.id },
          data: {
            saldato: paidAmount >= totalAmount - 0.009,
          },
        });
      }
    }
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/pagamenti");
}

export async function recordExpense(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);

  const description = (formData.get("expenseDescription") as string)?.trim();
  const supplierId = (formData.get("supplierId") as string) || null;
  const productId = (formData.get("productId") as string) || null;
  const expenseKind = ((formData.get("expenseKind") as string) || "service").toLowerCase();
  const paymentType = ((formData.get("paymentType") as string) || "electronic").toLowerCase();
  const purchaseDate = formData.get("purchaseDate") as string;
  const amount = (formData.get("expenseAmount") as string)?.trim();
  const note = (formData.get("expenseNote") as string)?.trim();

  if (!description || !amount || !purchaseDate) throw new Error("Dati mancanti");

  const [supplier, product] = await Promise.all([
    supplierId ? prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }) : null,
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true } }) : null,
  ]);

  const details: string[] = [
    expenseKind === "material" ? "Spesa materiale" : "Spesa servizio",
    description,
  ];

  if (supplier?.name) details.push(`Fornitore: ${supplier.name}`);
  if (product?.name) details.push(`Materiale: ${product.name}`);
  details.push(`Pagamento: ${paymentType === "cash" ? "contanti" : "elettronico"}`);
  if (note) details.push(note);

  await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: details.join(" · "),
      amount,
      occurredAt: new Date(purchaseDate),
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
}

export async function createCashAdvance(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = formData.get("patientId") as string;
  const amount = (formData.get("amount") as string)?.trim();
  const issuedAt = formData.get("issuedAt") as string;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!patientId || !amount || !issuedAt) throw new Error("Dati mancanti");

  await prisma.cashAdvance.create({
    data: {
      patientId,
      amount,
      issuedAt: new Date(issuedAt),
      note,
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}

export async function createDoctorPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const doctorId = (formData.get("doctorId") as string) || "";
  const amountRaw = (formData.get("amount") as string)?.trim() || "";
  const occurredAt = (formData.get("occurredAt") as string) || "";
  const note = ((formData.get("note") as string) || "").trim();
  const methodRaw = ((formData.get("paymentMethod") as string) || PatientPaymentMethod.ELECTRONIC).toUpperCase();
  const method = Object.values(PatientPaymentMethod).includes(methodRaw as PatientPaymentMethod)
    ? (methodRaw as PatientPaymentMethod)
    : PatientPaymentMethod.ELECTRONIC;

  if (!doctorId || !amountRaw || !occurredAt) {
    throw new Error("Dati mancanti");
  }

  const amountNumber = Number.parseFloat(amountRaw.replace(",", "."));
  if (Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error("Importo non valido");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { fullName: true },
  });

  if (!doctor) {
    throw new Error("Medico non trovato");
  }

  const methodLabel =
    method === PatientPaymentMethod.CASH
      ? "contanti"
      : method === PatientPaymentMethod.BANK_TRANSFER
        ? "bonifico"
        : method === PatientPaymentMethod.PAY_LATER
          ? "pagherò"
        : method === PatientPaymentMethod.OTHER
          ? "altro"
          : "elettronico";

  await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: ["Pagamento medico", `Metodo: ${methodLabel}`, note || "Liquidazione"].join(" · "),
      amount: new Prisma.Decimal(amountNumber),
      occurredAt: new Date(occurredAt),
      doctorId,
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}

export async function amendDoctorPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const entryId = (formData.get("entryId") as string) || "";
  const amountRaw = (formData.get("amount") as string)?.trim() || "";
  const occurredAt = (formData.get("occurredAt") as string) || "";
  const note = ((formData.get("note") as string) || "").trim();
  const methodRaw = ((formData.get("paymentMethod") as string) || PatientPaymentMethod.ELECTRONIC).toUpperCase();
  const method = Object.values(PatientPaymentMethod).includes(methodRaw as PatientPaymentMethod)
    ? (methodRaw as PatientPaymentMethod)
    : PatientPaymentMethod.ELECTRONIC;

  if (!entryId || !amountRaw || !occurredAt) {
    throw new Error("Dati mancanti");
  }

  const amountNumber = Number.parseFloat(amountRaw.replace(",", "."));
  if (Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error("Importo non valido");
  }

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error("Record non trovato");
  }

  const methodLabel =
    method === PatientPaymentMethod.CASH
      ? "contanti"
      : method === PatientPaymentMethod.BANK_TRANSFER
        ? "bonifico"
        : method === PatientPaymentMethod.PAY_LATER
          ? "pagherò"
        : method === PatientPaymentMethod.OTHER
          ? "altro"
          : "elettronico";

  const CORRETTO_MARKER = "(CORRETTO)";
  // If note is provided, we use it. If not, we try to extract the old note part from description
  let cleanNote = note;
  if (!cleanNote) {
    const parts = entry.description.split(" · ");
    cleanNote = parts.length > 2 ? parts.slice(2).join(" · ") : "";
  }
  
  let newDescription = ["Pagamento medico", `Metodo: ${methodLabel}`, cleanNote || "Liquidazione"].join(" · ");
  if (!newDescription.includes(CORRETTO_MARKER)) {
    newDescription = `${CORRETTO_MARKER} ${newDescription}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.financeEntry.update({
      where: { id: entryId },
      data: {
        amount: new Prisma.Decimal(amountNumber),
        occurredAt: new Date(occurredAt),
        description: newDescription,
      },
    });

    const auditLogClient = getOptionalPrismaModel<{
      create?: (args: {
        data: {
          action: string;
          entity: string;
          entityId: string;
          userId: string;
          metadata: Prisma.InputJsonValue;
        };
      }) => Promise<unknown>;
    }>("auditLog");

    if (auditLogClient?.create) {
      await auditLogClient.create({
        data: {
          action: "finance.doctor_payment.amend",
          entity: "FinanceEntry",
          entityId: entryId,
          userId: user.id,
          metadata: {
            oldAmount: entry.amount.toString(),
            newAmount: amountNumber.toString(),
            oldDate: entry.occurredAt.toISOString(),
            newDate: new Date(occurredAt).toISOString(),
            oldDescription: entry.description,
            newDescription: newDescription,
          },
        },
      });
    }
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}

export async function archiveDoctorPayment(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const entryId = formData.get("entryId") as string;
  if (!entryId) return;

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId },
    select: { description: true },
  });

  const ARCHIVE_PREFIX = "ARCHIVIATO:";
  if (!entry || entry.description.startsWith(ARCHIVE_PREFIX)) return;

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: { description: `${ARCHIVE_PREFIX} ${entry.description}` },
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}
