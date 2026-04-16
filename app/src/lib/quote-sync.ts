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
  
  // Bug fix: Do NOT revert to defaultPrice if it was manually changed.
  // We only force an update if paidAmount is greater than current total (to avoid negative remaining).
  // Otherwise, we keep the current price/total.
  const currentTotal = toNumber(linkedItem.total);
  const nextTotal = paidAmount > currentTotal + EPSILON ? paidAmount : currentTotal;
  const nextSaldato = paidAmount >= nextTotal - EPSILON;
  
  const shouldUpdate =
    linkedItem.serviceId !== service.id ||
    linkedItem.serviceName !== record.procedure ||
    linkedItem.quantity !== 1 ||
    Math.abs(toNumber(linkedItem.total) - nextTotal) > EPSILON ||
    linkedItem.saldato !== nextSaldato;

  if (!shouldUpdate) {
    return { synced: true, reason: "unchanged" as const };
  }

  await tx.quoteItem.update({
    where: { id: linkedItem.id },
    data: {
      serviceId: service.id,
      serviceName: record.procedure,
      quantity: 1,
      // price stays as is (derived from total for quantity 1)
      total: new Prisma.Decimal(nextTotal),
      price: new Prisma.Decimal(nextTotal),
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
  // 1. Fetch everything we need in bulk
  const [records, quote, allServices] = await Promise.all([
    tx.dentalRecord.findMany({
      where: { patientId },
      select: {
        id: true,
        treated: true,
        tooth: true,
        procedure: true,
        performedAt: true,
      },
      orderBy: [{ performedAt: "asc" }, { id: "asc" }],
    }),
    tx.quote.findUnique({
      where: { id: quoteId },
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
    }),
    tx.service.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, costBasis: true },
    }),
  ]);

  if (!quote || records.length === 0) {
    return { synced: false, recordCount: records.length };
  }

  const serviceMap = new Map<string, typeof allServices[0]>();
  for (const s of allServices) {
    serviceMap.set(s.name.toLowerCase(), s);
  }
  const fallbackService = allServices[0];

  let changed = false;

  // 2. Process records
  for (const record of records) {
    const service = serviceMap.get(record.procedure.toLowerCase()) ?? fallbackService;
    if (!service) continue;

    const linkedItem = quote.items.find((item) => item.dentalRecordId === record.id);
    const defaultPrice = toNumber(service.costBasis);

    if (!linkedItem) {
      await tx.quoteItem.create({
        data: {
          quoteId: quote.id,
          dentalRecordId: record.id,
          serviceId: service.id,
          serviceName: record.procedure,
          serviceDate: record.performedAt,
          quantity: 1,
          price: new Prisma.Decimal(defaultPrice),
          total: new Prisma.Decimal(defaultPrice),
          saldato: false,
        },
      });
      changed = true;
    } else {
      const paidAmount = linkedItem.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
      const currentTotal = toNumber(linkedItem.total);
      const nextTotal = paidAmount > currentTotal + EPSILON ? paidAmount : currentTotal;
      const nextSaldato = paidAmount >= nextTotal - EPSILON;

      const shouldUpdate =
        linkedItem.serviceId !== service.id ||
        linkedItem.serviceName !== record.procedure ||
        linkedItem.quantity !== 1 ||
        Math.abs(toNumber(linkedItem.total) - nextTotal) > EPSILON ||
        linkedItem.saldato !== nextSaldato;

      if (shouldUpdate) {
        await tx.quoteItem.update({
          where: { id: linkedItem.id },
          data: {
            serviceId: service.id,
            serviceName: record.procedure,
            quantity: 1,
            total: new Prisma.Decimal(nextTotal),
            price: new Prisma.Decimal(nextTotal),
            saldato: nextSaldato,
          },
        });
        changed = true;
      }
    }
  }

  if (changed) {
    // Refresh the local quote items list to get updated totals for the summary
    const updatedItems = await tx.quoteItem.findMany({
      where: { quoteId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (updatedItems.length > 0) {
      const total = updatedItems.reduce((sum, item) => sum + toNumber(item.total), 0);
      const primaryItem = updatedItems[0];

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
