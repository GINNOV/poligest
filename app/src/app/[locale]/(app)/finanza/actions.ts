"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function recordIncome(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = (formData.get("patientId") as string) || "";
  const deliveredAt = formData.get("deliveredAt") as string;
  const deliveredItemId = (formData.get("deliveredItemId") as string) || "";
  const amount = (formData.get("amount") as string)?.trim();
  const isPartial = formData.get("partialPayment") === "1";

  if (!patientId || !deliveredAt || !deliveredItemId || !amount) throw new Error("Dati mancanti");

  const [patient, diaryEntry] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true } }),
    prisma.dentalRecord.findUnique({ where: { id: deliveredItemId }, select: { procedure: true, notes: true, performedAt: true, patientId: true } }),
  ]);

  if (!patient || !diaryEntry || diaryEntry.patientId !== patientId) throw new Error("Dati non validi");

  const descriptionParts = [
    `Pagamento paziente ${patient.lastName} ${patient.firstName}`,
    diaryEntry.procedure,
  ];
  if (diaryEntry.notes) descriptionParts.push(diaryEntry.notes);
  if (isPartial) descriptionParts.push("[Parziale]");

  await prisma.financeEntry.create({
    data: {
      type: "INCOME",
      description: descriptionParts.join(" · "),
      amount,
      occurredAt: new Date(deliveredAt),
      userId: user.id,
    },
  });

  revalidatePath("/finanza");
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
}
