import { Prisma } from "@prisma/client";
import { allocateQuotePayments } from "@/lib/finance/domain-logic";

const EPSILON = 0.009;

type TransactionClient = Prisma.TransactionClient;
type SyncOptions = {
  refreshSummary?: boolean;
};

function toNumber(value: Prisma.Decimal | number) {
  return Number(value.toString());
}

function allocateQuoteSyncState(quote: {
  items: Array<{
    id: string;
    serviceName: string;
    quantity: number;
    total: Prisma.Decimal | number;
    createdAt: Date;
    dentalRecord?: { treated: boolean; tooth: number | null } | null;
  }>;
  payments: Array<{
    id: string;
    quoteItemId: string | null;
    amount: Prisma.Decimal | number;
    method: "CASH" | "ELECTRONIC" | "BANK_TRANSFER" | "PAY_LATER" | "OTHER";
    kind: "STANDARD" | "DOWNPAYMENT";
  }>;
}) {
  return allocateQuotePayments({
    items: quote.items.map((item) => ({
      id: item.id,
      serviceName: item.serviceName,
      quantity: item.quantity,
      total: toNumber(item.total),
      createdAt: item.createdAt,
      tooth: item.dentalRecord?.tooth,
      inProgress: Boolean(item.dentalRecord && !item.dentalRecord.treated),
    })),
    payments: quote.payments.map((payment) => ({
      id: payment.id,
      quoteItemId: payment.quoteItemId,
      amount: toNumber(payment.amount),
      method: payment.method,
      kind: payment.kind,
    })),
  });
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
            select: { amount: true, method: true, kind: true, quoteItemId: true, id: true },
          },
          dentalRecord: { select: { treated: true, tooth: true } },
        },
      },
      payments: {
        where: { archivedAt: null },
        select: { amount: true, method: true, kind: true, quoteItemId: true, id: true },
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
        isManualAdjustment: false,
      },
    });

    if (shouldRefreshSummary) {
      await refreshQuoteSummary(tx, quote.id);
    }
    return { synced: true, reason: "created" as const };
  }

  const quoteAllocation = allocateQuoteSyncState(quote);
  const linkedAllocation = quoteAllocation.items.find((item) => item.id === linkedItem.id);
  const paidAmount = (linkedAllocation?.paid ?? 0) + (linkedAllocation?.paghero ?? 0);
  
  // Logic: 
  // 1. If it's a manual adjustment, WE PRESERVE IT unless paidAmount > currentTotal.
  // 2. If it's NOT manual, we update it if the underlying service cost basis changed.
  
  const currentPrice = toNumber(linkedItem.price);
  
  let nextPrice = currentPrice;
  
  if (!linkedItem.isManualAdjustment) {
    // If not manual, we follow the service's current cost basis
    nextPrice = defaultPrice;
  }
  
  // Safety: Total can't be less than what was already paid
  const nextTotal = Math.max(nextPrice * linkedItem.quantity, paidAmount);
  // Re-sync price if total was adjusted by safety
  nextPrice = linkedItem.quantity > 0 ? nextTotal / linkedItem.quantity : nextPrice;

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
      total: new Prisma.Decimal(nextTotal),
      price: new Prisma.Decimal(nextPrice),
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
              select: { amount: true, method: true, kind: true, quoteItemId: true, id: true },
            },
            dentalRecord: { select: { treated: true, tooth: true } },
          },
        },
        payments: {
          where: { archivedAt: null },
          select: { amount: true, method: true, kind: true, quoteItemId: true, id: true },
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
          isManualAdjustment: false,
        },
      });
      changed = true;
    } else {
      const quoteAllocation = allocateQuoteSyncState(quote);
      const linkedAllocation = quoteAllocation.items.find((item) => item.id === linkedItem.id);
      const paidAmount = (linkedAllocation?.paid ?? 0) + (linkedAllocation?.paghero ?? 0);
      const currentPrice = toNumber(linkedItem.price);
      
      let nextPrice = currentPrice;
      if (!linkedItem.isManualAdjustment) {
        nextPrice = defaultPrice;
      }
      
      const nextTotal = Math.max(nextPrice * linkedItem.quantity, paidAmount);
      nextPrice = linkedItem.quantity > 0 ? nextTotal / linkedItem.quantity : nextPrice;
      
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
            price: new Prisma.Decimal(nextPrice),
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
