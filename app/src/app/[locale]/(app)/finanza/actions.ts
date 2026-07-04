"use server";

import { revalidatePath } from "next/cache";
import { PatientPaymentKind, PatientPaymentMethod, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { allocateQuotePayments } from "@/lib/finance/domain-logic";

type QuoteForPayment = NonNullable<Awaited<ReturnType<typeof getQuoteForPayment>>>;

function toAmount(value: Prisma.Decimal | number | { toString(): string }) {
  return Number(value.toString());
}

function parsePaymentKind(raw: FormDataEntryValue | null): PatientPaymentKind {
  const value = String(raw || PatientPaymentKind.STANDARD).toUpperCase();
  return Object.values(PatientPaymentKind).includes(value as PatientPaymentKind)
    ? (value as PatientPaymentKind)
    : PatientPaymentKind.STANDARD;
}

function getMethodLabel(method: PatientPaymentMethod) {
  return method === PatientPaymentMethod.CASH
    ? "contanti"
    : method === PatientPaymentMethod.BANK_TRANSFER
      ? "bonifico"
      : method === PatientPaymentMethod.PAY_LATER
        ? "pagherò"
      : method === PatientPaymentMethod.OTHER
        ? "insolvente"
        : "elettronico";
}

async function getQuoteForPayment(quoteId: string, patientId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, patientId },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          dentalRecord: { select: { updatedById: true, treated: true, tooth: true } },
          payments: {
            where: { archivedAt: null },
            select: { id: true, amount: true, method: true, kind: true, quoteItemId: true },
          },
        },
      },
      payments: {
        where: { archivedAt: null },
        select: { id: true, amount: true, method: true, kind: true, quoteItemId: true },
      },
    },
  });
}

function getQuoteAllocation(quote: QuoteForPayment) {
  return allocateQuotePayments({
    items: quote.items.map((item) => ({
      id: item.id,
      serviceName: item.serviceName,
      quantity: item.quantity,
      total: toAmount(item.total),
      createdAt: item.createdAt,
      tooth: item.dentalRecord?.tooth,
      inProgress: Boolean(item.dentalRecord && !item.dentalRecord.treated),
    })),
    payments: quote.payments.map((payment) => ({
      id: payment.id,
      quoteItemId: payment.quoteItemId,
      amount: toAmount(payment.amount),
      method: payment.method,
      kind: payment.kind,
    })),
  });
}

async function refreshQuoteItemSettlementState(
  tx: Prisma.TransactionClient,
  quoteId: string,
  patientId: string
) {
  const quote = await tx.quote.findFirst({
    where: { id: quoteId, patientId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          dentalRecord: { select: { treated: true, tooth: true } },
        },
      },
      payments: {
        where: { archivedAt: null },
        select: { id: true, amount: true, method: true, kind: true, quoteItemId: true },
      },
    },
  });

  if (!quote) return;

  const allocation = allocateQuotePayments({
    items: quote.items.map((item) => ({
      id: item.id,
      serviceName: item.serviceName,
      quantity: item.quantity,
      total: toAmount(item.total),
      createdAt: item.createdAt,
      tooth: item.dentalRecord?.tooth,
      inProgress: Boolean(item.dentalRecord && !item.dentalRecord.treated),
    })),
    payments: quote.payments.map((payment) => ({
      id: payment.id,
      quoteItemId: payment.quoteItemId,
      amount: toAmount(payment.amount),
      method: payment.method,
      kind: payment.kind,
    })),
  });

  await Promise.all(allocation.items.map((item) =>
    tx.quoteItem.update({
      where: { id: item.id },
      data: { saldato: item.saldato },
    })
  ));
}

export async function recordPatientPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = (formData.get("patientId") as string) || "";
  const quoteId = (formData.get("quoteId") as string) || "";
  const quoteItemId = (formData.get("quoteItemId") as string) || "";
  const explicitDoctorId = (formData.get("doctorId") as string) || null;
  const amountRaw = (formData.get("amount") as string)?.trim();
  const paidAt = (formData.get("paidAt") as string) || "";
  const note = ((formData.get("note") as string) || "").trim() || null;
  const kind = parsePaymentKind(formData.get("paymentKind"));
  const methodRaw = ((formData.get("paymentMethod") as string) || PatientPaymentMethod.ELECTRONIC).toUpperCase();
  const method = Object.values(PatientPaymentMethod).includes(methodRaw as PatientPaymentMethod)
    ? (methodRaw as PatientPaymentMethod)
    : PatientPaymentMethod.ELECTRONIC;

  if (!patientId || !quoteId || !amountRaw || !paidAt || (kind === PatientPaymentKind.STANDARD && !quoteItemId)) {
    throw new Error("Dati mancanti");
  }

  const paidAtDate = new Date(paidAt);
  if (Number.isNaN(paidAtDate.getTime())) {
    throw new Error("Data non valida");
  }

  const amountNumber = Number.parseFloat(amountRaw.replace(",", "."));
  if (Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error("Importo non valido");
  }

  const quote = await getQuoteForPayment(quoteId, patientId);
  if (!quote) {
    throw new Error("Preventivo non trovato");
  }

  const quoteItem = kind === PatientPaymentKind.STANDARD
    ? quote.items.find((item) => item.id === quoteItemId)
    : null;

  if (kind === PatientPaymentKind.STANDARD && !quoteItem) {
    throw new Error("Prestazione del preventivo non trovata");
  }

  const allocation = getQuoteAllocation(quote);
  if (kind === PatientPaymentKind.DOWNPAYMENT) {
    if (amountNumber - allocation.remaining > 0.009) {
      throw new Error("L'acconto supera il residuo del preventivo");
    }
  } else if (quoteItem) {
    const selectedSummary = allocation.items.find((item) => item.id === quoteItem.id);
    const residual = selectedSummary?.remaining ?? 0;
    if (amountNumber - residual > 0.009) {
      throw new Error("L'importo supera il residuo della prestazione selezionata");
    }
  }

  // Try to find the doctor responsible for this payment
  let targetDoctorId: string | null = explicitDoctorId;

  if (!targetDoctorId && quoteItem?.dentalRecord?.updatedById) {
    const doc = await prisma.doctor.findUnique({
      where: { userId: quoteItem.dentalRecord.updatedById },
      select: { id: true },
    });
    if (doc) targetDoctorId = doc.id;
  }

  if (!targetDoctorId) {
    const lastAppt = await prisma.appointment.findFirst({
      where: { patientId, doctorId: { not: null } },
      orderBy: { startsAt: "desc" },
      select: { doctorId: true },
    });
    if (lastAppt) targetDoctorId = lastAppt.doctorId;
  }

  // Final fallback: most frequent doctor for this patient
  if (!targetDoctorId) {
    const agg = await prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { patientId, doctorId: { not: null } },
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: "desc" } },
      take: 1,
    });
    if (agg.length > 0) targetDoctorId = agg[0].doctorId;
  }

  const patientName =
    `${quote.patient.lastName ?? ""} ${quote.patient.firstName ?? ""}`.trim() || "Paziente";
  const methodLabel = getMethodLabel(method);
  const paymentQuoteItemId = kind === PatientPaymentKind.DOWNPAYMENT ? null : quoteItemId;
  const descriptionTitle = kind === PatientPaymentKind.DOWNPAYMENT
    ? `Acconto preventivo paziente ${patientName}`
    : `Pagamento paziente ${patientName}`;

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.patientPayment.create({
      data: {
        patientId,
        quoteId,
        quoteItemId: paymentQuoteItemId,
        amount: new Prisma.Decimal(amountNumber),
        paidAt: paidAtDate,
        method,
        kind,
        note,
        userId: user.id,
      },
    });

    await refreshQuoteItemSettlementState(tx, quoteId, patientId);

    await tx.financeEntry.create({
      data: {
        type: "INCOME",
        description: [
          descriptionTitle,
          quoteItem?.serviceName,
          `Metodo: ${methodLabel}`,
          note,
        ]
          .filter(Boolean)
          .join(" · "),
        amount: new Prisma.Decimal(amountNumber),
        occurredAt: paidAtDate,
        doctorId: targetDoctorId,
        userId: user.id,
        patientId: patientId,
        method: method,
        metadata: {
          paymentId: p.id,
          quoteId,
          quoteItemId: paymentQuoteItemId,
          paymentKind: kind,
        },
      },
    });

    return p;
  });

  await logAudit(user, {
    action: "finance.patient_payment.recorded",
    entity: "PatientPayment",
    entityId: payment.id,
    metadata: {
      patientId,
      quoteId,
      amount: amountNumber,
      method,
      kind,
      quoteItemId: paymentQuoteItemId,
    },
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/pagamenti");
}

export async function archivePatientPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const paymentId = (formData.get("paymentId") as string) || "";

  if (!paymentId) {
    throw new Error("Pagamento non valido");
  }

  const payment = await prisma.patientPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      patientId: true,
      quoteId: true,
      quoteItemId: true,
      kind: true,
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

  const ARCHIVE_PREFIX = "[ARCHIVIO] ";

  // Find associated FinanceEntry if it exists in metadata
  // We do this OUTSIDE the transaction because findFirst on JSON fields 
  // might have different support in transaction proxies/mocks.
  const relatedEntry = await prisma.financeEntry.findFirst({
    where: {
      metadata: {
        path: ["paymentId"],
        equals: payment.id,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.patientPayment.update({
      where: { id: payment.id },
      data: { archivedAt: new Date() },
    });

    if (relatedEntry && !relatedEntry.description.startsWith(ARCHIVE_PREFIX)) {
      await tx.financeEntry.update({
        where: { id: relatedEntry.id },
        data: {
          description: `${ARCHIVE_PREFIX}${relatedEntry.description}`,
        },
      });
    }

    if (payment.quoteId) {
      await refreshQuoteItemSettlementState(tx, payment.quoteId, payment.patientId);
    }
  });

  await logAudit(user, {
    action: "finance.patient_payment.archived",
    entity: "PatientPayment",
    entityId: paymentId,
    metadata: {
      patientId: payment.patientId,
      quoteId: payment.quoteId,
      quoteItemId: payment.quoteItemId,
      kind: payment.kind,
    },
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

  const purchaseDateDate = new Date(purchaseDate);
  if (Number.isNaN(purchaseDateDate.getTime())) {
    throw new Error("Data non valida");
  }

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

  const entry = await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: details.join(" · "),
      amount,
      occurredAt: purchaseDateDate,
      userId: user.id,
    },
  });

  await logAudit(user, {
    action: "finance.expense.recorded",
    entity: "FinanceEntry",
    entityId: entry.id,
    metadata: {
      description,
      amount,
      expenseKind,
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

  const issuedAtDate = new Date(issuedAt);
  if (Number.isNaN(issuedAtDate.getTime())) {
    throw new Error("Data non valida");
  }

  const [patient, lastAppt] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true },
    }),
    prisma.appointment.findFirst({
      where: { patientId, doctorId: { not: null } },
      orderBy: { startsAt: "desc" },
      select: { doctorId: true },
    }),
  ]);

  const patientName = patient ? `${patient.lastName} ${patient.firstName}` : "Paziente";
  const targetDoctorId = lastAppt?.doctorId ?? null;

  const advance = await prisma.$transaction(async (tx) => {
    const adv = await tx.cashAdvance.create({
      data: {
        patientId,
        amount: new Prisma.Decimal(amount.replace(",", ".")),
        issuedAt: issuedAtDate,
        note,
        userId: user.id,
      },
    });

    await tx.financeEntry.create({
      data: {
        type: "INCOME",
        description: [`Anticipo paziente ${patientName}`, note].filter(Boolean).join(" · "),
        amount: new Prisma.Decimal(amount.replace(",", ".")),
        occurredAt: issuedAtDate,
        doctorId: targetDoctorId,
        userId: user.id,
        patientId: patientId,
        metadata: {
          advanceId: adv.id,
        },
      },
    });

    return adv;
  });

  await logAudit(user, {
    action: "finance.cash_advance.created",
    entity: "CashAdvance",
    entityId: advance.id,
    metadata: {
      patientId,
      amount,
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

  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error("Data non valida");
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
          ? "insolvente"
          : "elettronico";

  const entry = await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: ["Pagamento medico", `Metodo: ${methodLabel}`, note || "Liquidazione"].join(" · "),
      amount: new Prisma.Decimal(amountNumber),
      occurredAt: occurredAtDate,
      doctorId,
      userId: user.id,
    },
  });

  await logAudit(user, {
    action: "finance.doctor_payment.created",
    entity: "FinanceEntry",
    entityId: entry.id,
    metadata: {
      doctorId,
      amount: amountNumber,
      method,
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

  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error("Data non valida");
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
          ? "insolvente"
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
        occurredAt: occurredAtDate,
        description: newDescription,
      },
    });

    await logAudit(user, {
      action: "finance.doctor_payment.amend",
      entity: "FinanceEntry",
      entityId: entryId,
      metadata: {
        oldAmount: entry.amount.toString(),
        newAmount: amountNumber.toString(),
        oldDate: entry.occurredAt.toISOString(),
        newDate: occurredAtDate.toISOString(),
        oldDescription: entry.description,
        newDescription: newDescription,
      },
    });
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}

export async function archiveDoctorPayment(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const entryId = (formData.get("entryId") as string) || "";
  const ARCHIVE_PREFIX = "[ARCHIVIO] ";

  if (!entryId) {
    throw new Error("Movimento non valido");
  }

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId },
    select: { description: true },
  });

  if (!entry) {
    throw new Error("Movimento non trovato");
  }

  if (entry.description.startsWith(ARCHIVE_PREFIX)) {
    revalidatePath("/finanza");
    revalidatePath("/finanza/anticipi");
    return;
  }

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: {
      description: `${ARCHIVE_PREFIX}${entry.description}`,
    },
  });

  await logAudit(user, {
    action: "finance.doctor_payment.archived",
    entity: "FinanceEntry",
    entityId: entryId,
    metadata: {
      oldDescription: entry.description,
    },
  });

  revalidatePath("/finanza");
  revalidatePath("/finanza/anticipi");
}
