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
      tooth: true,
      procedure: true,
      performedAt: true,
    },
  });

  if (!record) {
    return { synced: false, reason: "record_not_found" as const };
  }

  let service = await tx.service.findFirst({
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

  // If no exact service match, fallback to any service but keep the record's procedure name
  if (!service) {
    service = await tx.service.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, costBasis: true },
    });
  }

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
        serviceName: record.procedure, // Always use the clinical name
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
  
  // We check if the name matches the clinical record even if the service link is the same
  const shouldUpdate =
    linkedItem.serviceId !== service.id ||
    linkedItem.serviceName !== record.procedure ||
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
      serviceName: record.procedure, // Ensure sync
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
  let quote = await tx.quote.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // If no quote exists, create an initial "Clinical Diary" quote to house these items
  if (!quote) {
    const record = await tx.dentalRecord.findUnique({
      where: { id: dentalRecordId },
      select: { procedure: true, performedAt: true },
    });
    
    if (record) {
      const service = (await tx.service.findFirst({
        where: { name: { equals: record.procedure, mode: "insensitive" } },
        select: { id: true, costBasis: true },
      })) || (await tx.service.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, costBasis: true },
      }));

      if (service) {
        quote = await tx.quote.create({
          data: {
            patientId,
            serviceId: service.id,
            serviceName: record.procedure,
            serviceDate: record.performedAt,
            quantity: 1,
            price: service.costBasis,
            total: service.costBasis,
            signatureUrl: "", // Mark as needs signature
            signedAt: new Date(0), // Placeholder
          },
          select: { id: true },
        });
      }
    }
  }

  if (!quote) {
    return { synced: false, reason: "quote_not_found" as const };
  }

  return syncDentalRecordIntoQuote(tx, quote.id, patientId, dentalRecordId);
}
