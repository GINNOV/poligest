import { type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function deletePatientWithRelations(
  patientId: string,
  client: DbClient = prisma,
) {
  const quotes = await client.quote.findMany({
    where: { patientId },
    select: { id: true },
  });
  const quoteIds = quotes.map((quote) => quote.id);

  if (quoteIds.length > 0) {
    await client.patientPayment.deleteMany({
      where: {
        OR: [{ patientId }, { quoteId: { in: quoteIds } }],
      },
    });
    await client.quoteItem.deleteMany({
      where: { quoteId: { in: quoteIds } },
    });
    await client.quote.deleteMany({
      where: { id: { in: quoteIds } },
    });
  } else {
    await client.patientPayment.deleteMany({
      where: { patientId },
    });
  }

  await client.appointmentReminder.deleteMany({
    where: { patientId },
  });
  await client.appointment.deleteMany({
    where: { patientId },
  });
  await client.clinicalNote.deleteMany({
    where: { patientId },
  });
  await client.dentalRecord.deleteMany({
    where: { patientId },
  });
  await client.recall.deleteMany({
    where: { patientId },
  });
  await client.recurringMessageLog.deleteMany({
    where: { patientId },
  });
  await client.stockMovement.deleteMany({
    where: { patientId },
  });
  await client.patientConsent.deleteMany({
    where: { patientId },
  });
  await client.smsLog.deleteMany({
    where: { patientId },
  });
  await client.cashAdvance.deleteMany({
    where: { patientId },
  });
  await client.financeEntry.deleteMany({
    where: { patientId },
  });

  await client.patient.delete({
    where: { id: patientId },
  });
}