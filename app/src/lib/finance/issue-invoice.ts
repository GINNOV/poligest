import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRACTICE_TIME_ZONE, PRACTICE_SETTINGS_ID, isPracticeTimeZone } from "@/lib/practice-time-zone";
import {
  billableLines,
  invoiceYear,
  nextInvoiceNumber,
  parseInvoiceSourceKey,
  selectInvoiceLines,
  snapshotPatientName,
  type InvoiceSourceRef,
  type QuoteForInvoice,
} from "@/lib/finance/invoices";

export class InvoiceIssueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceIssueError";
  }
}

function money(value: { toString(): string }) {
  return Number(value.toString());
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function isInvoiceNumberConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toQuoteSource(quote: {
  id: string;
  serviceName: string;
  serviceDate: Date;
  quantity: number;
  price: { toString(): string };
  total: { toString(): string };
  items: Array<{
    id: string;
    serviceName: string;
    serviceDate: Date;
    quantity: number;
    price: { toString(): string };
    total: { toString(): string };
  }>;
}): QuoteForInvoice {
  return {
    id: quote.id,
    serviceName: quote.serviceName,
    serviceDate: quote.serviceDate,
    quantity: quote.quantity,
    price: money(quote.price),
    total: money(quote.total),
    items: quote.items.map((item) => ({
      id: item.id,
      serviceName: item.serviceName,
      serviceDate: item.serviceDate,
      quantity: item.quantity,
      price: money(item.price),
      total: money(item.total),
    })),
  };
}

export async function issueStudioInvoice(input: {
  patientId: string;
  sourceKeys: string[];
  userId: string;
  issuedAt?: Date;
}) {
  const selectedKeys = input.sourceKeys
    .map(parseInvoiceSourceKey)
    .filter((source): source is { quoteId: string; quoteItemId: string | null } => source !== null)
    .map((source) => `${source.quoteId}:${source.quoteItemId ?? ""}`);

  if (selectedKeys.length !== input.sourceKeys.length) {
    throw new InvoiceIssueError("Alcune righe non sono più disponibili. Aggiorna la pagina.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.findUnique({
          where: { id: input.patientId },
          select: { id: true, firstName: true, lastName: true, taxId: true },
        });
        if (!patient) throw new InvoiceIssueError("Paziente non trovato.");

        await tx.$queryRaw`SELECT id FROM "public"."Patient" WHERE id = ${patient.id} FOR UPDATE`;

        const [quotes, invoiceLines, settings] = await Promise.all([
          tx.quote.findMany({
            where: { patientId: patient.id },
            orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
            include: { items: { orderBy: { createdAt: "asc" } } },
          }),
          tx.invoiceLine.findMany({
            where: { invoice: { patientId: patient.id } },
            select: {
              quoteId: true,
              quoteItemId: true,
              invoice: { select: { status: true } },
            },
          }),
          tx.practiceSetting.findUnique({
            where: { id: PRACTICE_SETTINGS_ID },
            select: { timeZone: true },
          }),
        ]);

        const sources: InvoiceSourceRef[] = invoiceLines.map((line) => ({
          quoteId: line.quoteId,
          quoteItemId: line.quoteItemId,
          status: line.invoice.status,
        }));
        const selected = selectInvoiceLines(
          billableLines(quotes.map(toQuoteSource), sources),
          selectedKeys,
        );
        if (!selected.ok) throw new InvoiceIssueError(selected.message);

        const timeZone = isPracticeTimeZone(settings?.timeZone) ? settings.timeZone : DEFAULT_PRACTICE_TIME_ZONE;
        const issuedAt = input.issuedAt ?? new Date();
        const year = invoiceYear(issuedAt, timeZone);
        const used = await tx.invoice.findMany({
          where: { year },
          select: { number: true },
        });
        const number = nextInvoiceNumber(used.map((row) => row.number));

        const invoice = await tx.invoice.create({
          data: {
            year,
            number,
            issuedAt,
            patientId: patient.id,
            patientName: snapshotPatientName(patient.lastName, patient.firstName),
            patientTaxId: patient.taxId,
            total: decimal(selected.total),
            userId: input.userId,
            lines: {
              create: selected.lines.map((line) => ({
                quoteId: line.quoteId,
                quoteItemId: line.quoteItemId,
                serviceName: line.serviceName,
                serviceDate: line.serviceDate,
                quantity: line.quantity,
                price: decimal(line.price),
                total: decimal(line.total),
              })),
            },
          },
          select: { id: true, year: true, number: true },
        });
        return invoice;
      });
    } catch (error) {
      if (error instanceof InvoiceIssueError) throw error;
      if (isInvoiceNumberConflict(error) && attempt < 2) continue;
      if (isInvoiceNumberConflict(error)) {
        throw new InvoiceIssueError("Non è stato possibile assegnare il numero fattura. Riprova.");
      }
      throw error;
    }
  }

  throw new InvoiceIssueError("Non è stato possibile assegnare il numero fattura. Riprova.");
}

export async function voidStudioInvoice(invoiceId: string) {
  const updated = await prisma.invoice.updateMany({
    where: { id: invoiceId, status: "ISSUED" },
    data: { status: "VOID", voidedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new InvoiceIssueError("Questa fattura è già annullata.");
  }
}
