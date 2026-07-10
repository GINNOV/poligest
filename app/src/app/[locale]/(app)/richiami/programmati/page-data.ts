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

export async function getFailedDeliveryRecalls() {
  try {
    return await prisma.recall.findMany({
      where: {
        status: RecallStatus.SKIPPED,
        deliveryFailureDismissedAt: null,
      },
      orderBy: [{ lastContactAt: "desc" }, { dueAt: "desc" }],
      select: {
        id: true,
        dueAt: true,
        lastContactAt: true,
        patient: { select: { firstName: true, lastName: true } },
        rule: { select: { name: true, channel: true } },
      },
    });
  } catch (error) {
    if (isMissingDeliveryDismissalColumn(error)) {
      console.warn("[richiami/programmati] failed delivery alerts unavailable until recall migration is applied");
      return [];
    }

    throw error;
  }
}
