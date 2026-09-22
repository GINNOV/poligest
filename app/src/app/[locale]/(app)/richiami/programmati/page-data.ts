import { Prisma, RecallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ScheduledRecallListItem = Prisma.RecallGetPayload<{
  select: {
    id: true;
    dueAt: true;
    status: true;
    notes: true;
    patient: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        phone: true;
      };
    };
    rule: {
      select: {
        id: true;
        name: true;
        serviceType: true;
        templateName: true;
        message: true;
        emailSubject: true;
        channel: true;
      };
    };
  };
}>;

function isMissingDeliveryDismissalColumn(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
    return false;
  }

  const details = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  return details.includes("deliveryFailureDismissedAt");
}

export const FAILED_DELIVERY_PAGE_SIZE = 20;

const failedDeliverySelect = {
  id: true,
  dueAt: true,
  lastContactAt: true,
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  rule: { select: { name: true, channel: true } },
} as const;

export type FailedDeliveryRecallRecord = Prisma.RecallGetPayload<{
  select: typeof failedDeliverySelect;
}>;

export function failedDeliveryRecallWhere(query: string): Prisma.RecallWhereInput {
  const q = query.trim();
  const base: Prisma.RecallWhereInput = {
    status: RecallStatus.SKIPPED,
    deliveryFailureDismissedAt: null,
  };
  if (!q) return base;

  return {
    ...base,
    OR: [
      { patient: { firstName: { contains: q, mode: "insensitive" } } },
      { patient: { lastName: { contains: q, mode: "insensitive" } } },
      { patient: { phone: { contains: q, mode: "insensitive" } } },
      { patient: { email: { contains: q, mode: "insensitive" } } },
      { rule: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

function unavailableFailedDeliveries(error: unknown) {
  if (!isMissingDeliveryDismissalColumn(error)) return false;
  console.warn("[richiami/programmati] failed delivery alerts unavailable until recall migration is applied");
  return true;
}

export async function countFailedDeliveryRecalls(query = "") {
  try {
    return await prisma.recall.count({ where: failedDeliveryRecallWhere(query) });
  } catch (error) {
    if (unavailableFailedDeliveries(error)) return 0;
    throw error;
  }
}

export async function listFailedDeliveryRecalls(input: {
  readonly query: string;
  readonly skip: number;
  readonly take: number;
}) {
  try {
    return await prisma.recall.findMany({
      where: failedDeliveryRecallWhere(input.query),
      orderBy: [{ lastContactAt: "desc" }, { dueAt: "desc" }],
      select: failedDeliverySelect,
      skip: input.skip,
      take: input.take,
    });
  } catch (error) {
    if (unavailableFailedDeliveries(error)) return [];
    throw error;
  }
}
