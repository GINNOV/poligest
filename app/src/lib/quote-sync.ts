import { Prisma } from "@prisma/client";

const EPSILON = 0.009;

type TransactionClient = Prisma.TransactionClient;
type SyncOptions = {
  refreshSummary?: boolean;
};

function toNumber(value: Prisma.Decimal | number) {
  return Number(value.toString());
}

async function refreshQuoteSummary(tx: TransactionClient, quoteId: string) {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!quote || quote.items.length === 0) {
    return;
  }

  const total = quote.items.reduce((sum, item) => sum + toNumber(item.total), 0);
  const primaryItem = quote.items[0];

  await tx.quote.update({
    where: { id: quoteId },
    data: {
      serviceId: primaryItem.serviceId,
      serviceName: primaryItem.serviceName,
      serviceDate: primaryItem.serviceDate,
      quantity: primaryItem.quantity,
      price: primaryItem.price,
      total: new Prisma.Decimal(total),
    },
  });
}

async function syncDentalRecordIntoQuote(
  tx: TransactionClient,
  quoteId: string,
  patientId: string,
  dentalRecordId: string,
  options: SyncOptions = {}
) {
  const { refreshSummary: shouldRefreshSummary = true } = options;
  const record = await tx.dentalRecord.findFirst({
    where: { id: dentalRecordId, patientId },
    select: {
      id: true,
      treated: true,
      procedure: true,
      performedAt: true,
    },
  });

  if (!record) {
    return { synced: false, reason: "record_not_found" as const };
  }

  const service = await tx.service.findFirst({
    where: {
      name: {
        equals: record.procedure,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      costBasis: true,
    },
  });

  if (!service) {
    return { synced: false, reason: "service_not_found" as const };
  }

  const quote = await tx.quote.findFirst({
    where: { id: quoteId, patientId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          payments: {
            select: { amount: true },
          },
        },
      },
    },
  });

  if (!quote) {
    return { synced: false, reason: "quote_not_found" as const };
  }

  const linkedItem = quote.items.find((item) => item.dentalRecordId === record.id);
  const defaultPrice = toNumber(service.costBasis);

  if (!linkedItem) {
    await tx.quoteItem.create({
      data: {
        quoteId: quote.id,
        dentalRecordId: record.id,
        serviceId: service.id,
        serviceName: service.name,
        serviceDate: record.performedAt,
        quantity: 1,
        price: new Prisma.Decimal(defaultPrice),
        total: new Prisma.Decimal(defaultPrice),
        saldato: false,
      },
    });

    if (shouldRefreshSummary) {
      await refreshQuoteSummary(tx, quote.id);
    }
    return { synced: true, reason: "created" as const };
  }

  const paidAmount = linkedItem.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const nextAmount = paidAmount - defaultPrice > EPSILON ? toNumber(linkedItem.total) : defaultPrice;
  const nextSaldato = paidAmount >= nextAmount - EPSILON;
  const shouldUpdate =
    linkedItem.serviceId !== service.id ||
    linkedItem.serviceName !== service.name ||
    linkedItem.quantity !== 1 ||
    Math.abs(toNumber(linkedItem.price) - nextAmount) > EPSILON ||
    Math.abs(toNumber(linkedItem.total) - nextAmount) > EPSILON ||
    linkedItem.saldato !== nextSaldato;

  if (!shouldUpdate) {
    return { synced: true, reason: "unchanged" as const };
  }

  await tx.quoteItem.update({
    where: { id: linkedItem.id },
    data: {
      serviceId: service.id,
      serviceName: service.name,
      quantity: 1,
      price: new Prisma.Decimal(nextAmount),
      total: new Prisma.Decimal(nextAmount),
      saldato: nextSaldato,
    },
  });

  if (shouldRefreshSummary) {
    await refreshQuoteSummary(tx, quote.id);
  }
  return { synced: true, reason: "updated" as const };
}

export async function syncAllDentalRecordsIntoQuote(
  tx: TransactionClient,
  patientId: string,
  quoteId: string
) {
  const records = await tx.dentalRecord.findMany({
    where: { patientId },
    select: { id: true },
    orderBy: [{ performedAt: "asc" }, { id: "asc" }],
  });

  let changed = false;

  for (const record of records) {
    const result = await syncDentalRecordIntoQuote(tx, quoteId, patientId, record.id, {
      refreshSummary: false,
    });
    if (result.synced && result.reason !== "unchanged") {
      changed = true;
    }
  }

  if (changed) {
    await refreshQuoteSummary(tx, quoteId);
  }

  return { synced: changed, recordCount: records.length };
}

export async function syncDentalRecordIntoLatestQuote(
  tx: TransactionClient,
  patientId: string,
  dentalRecordId: string
) {
  const quote = await tx.quote.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!quote) {
    return { synced: false, reason: "quote_not_found" as const };
  }

  return syncDentalRecordIntoQuote(tx, quote.id, patientId, dentalRecordId);
}
