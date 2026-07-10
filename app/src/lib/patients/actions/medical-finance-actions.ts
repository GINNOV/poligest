"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { ConsentStatus, Prisma, Role, StockMovementType } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { prisma } from "@/lib/prisma";
import { syncAllDentalRecordsIntoQuote } from "@/lib/quote-sync";
import { ASSISTANT_ROLE } from "@/lib/roles";

const STAFF_ROLES = [Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY] as const;

const buildImplantNote = (product: { name: string; brand: string | null; udiDi: string | null }) =>
  [
    product.name ? `Tipo: ${product.name}` : null,
    product.brand ? `Marca: ${product.brand}` : null,
    product.udiDi ? `UDI-DI: ${product.udiDi}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

type NormalizedQuoteItem = {
  id: string | null;
  serviceId: string;
  serviceName: string;
  serviceDate: Date;
  quantity: number;
  price: number;
  total: number;
  tooth?: number | null;
  saldato: boolean;
  isManualAdjustment: boolean;
};

type PersistedQuoteItem = {
  id: string;
  serviceId: string | null;
  serviceDate: Date;
  quantity: number;
  price: { toString(): string };
  total: { toString(): string };
  tooth?: number | null;
};

type QuoteWithItemsForSave = Prisma.QuoteGetPayload<{ include: { items: true } }>;

function quoteItemsMatchPersisted(
  persistedItems: readonly PersistedQuoteItem[],
  normalizedItems: readonly NormalizedQuoteItem[],
) {
  if (persistedItems.length !== normalizedItems.length) return false;

  const persistedById = new Map(persistedItems.map((item) => [item.id, item]));
  return normalizedItems.every((item) => {
    if (!item.id) return false;
    const persisted = persistedById.get(item.id);
    if (!persisted) return false;
    if (!(persisted.serviceDate instanceof Date)) return false;

    return (
      persisted.serviceId === item.serviceId &&
      persisted.serviceDate.getTime() === item.serviceDate.getTime() &&
      persisted.quantity === item.quantity &&
      Number(persisted.price.toString()) === item.price &&
      Number(persisted.total.toString()) === item.total &&
      (persisted.tooth ?? null) === (item.tooth ?? null)
    );
  });
}

export async function addImplantAssociationAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const patientId = (formData.get("patientId") as string) || "";
  const productId = (formData.get("productId") as string) || "";
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!patientId || !productId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, brand: true, udiDi: true, udiPi: true },
  });
  if (!product) {
    throw new Error("Impianto non trovato in magazzino");
  }

  await prisma.stockMovement.create({
    data: {
      productId,
      quantity: 1,
      movement: StockMovementType.OUT,
      note: buildImplantNote(product),
      patientId,
      udiPi: product.udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_added",
    entity: "Patient",
    entityId: patientId,
    metadata: { productId, udiPi: product.udiPi, brand: product.brand, deviceType: product.name, interventionSite },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

export async function updateImplantAssociationAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const implantId = (formData.get("implantId") as string) || "";
  const patientId = (formData.get("patientId") as string) || "";
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!implantId || !patientId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;
  const existingImplant = await prisma.stockMovement.findFirst({
    where: { id: implantId, patientId },
    include: { product: { select: { id: true, name: true, brand: true, udiDi: true, udiPi: true } } },
  });
  if (!existingImplant) {
    throw new Error("Impianto associato non trovato");
  }

  await prisma.stockMovement.update({
    where: { id: implantId },
    data: {
      note: buildImplantNote(existingImplant.product),
      udiPi: existingImplant.product.udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_updated",
    entity: "Patient",
    entityId: patientId,
    metadata: { implantId, productId: existingImplant.productId },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

export async function savePreventivoAction(_: { savedAt: number; error?: string | null }, formData: FormData) {
  try {
    const user = await requireUser([...STAFF_ROLES]);
    const patientId = (formData.get("patientId") as string) || "";
    const quoteId = (formData.get("quoteId") as string)?.trim() || null;
    const itemsRaw = (formData.get("itemsJson") as string) || "";
    const signatureData = (formData.get("quoteSignatureData") as string)?.trim();
    const existingSignatureUrl = (formData.get("existingQuoteSignatureUrl") as string)?.trim() || null;

    if (!patientId || !itemsRaw) {
      return { savedAt: 0, error: "Preventivo non valido" };
    }

    let itemsPayload: Array<{
      id?: string;
      serviceId: string;
      serviceDate: string;
      quantity: number;
      price: number;
      tooth?: number | null;
    }> = [];
    try {
      itemsPayload = JSON.parse(itemsRaw);
    } catch {
      return { savedAt: 0, error: "Dati preventivo non validi" };
    }

    if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return { savedAt: 0, error: "Inserisci almeno una prestazione" };
    }

    if (!signatureData?.startsWith("data:image/png") && !existingSignatureUrl) {
      return { savedAt: 0, error: "Firma digitale obbligatoria" };
    }

    const serviceClient = getOptionalPrismaModel<{
      findMany?: (args?: {
        where?: { id: { in: string[] } };
        select?: { id: true; name: true; costBasis: true };
      }) => Promise<{ id: string; name: string; costBasis: Prisma.Decimal }[]>;
    }>("service");
    const patientPaymentClient = getOptionalPrismaModel<{
      findMany?: (args: {
        where: { quoteItemId: { in: string[] } };
        select: { quoteItemId: true; amount: true };
      }) => Promise<Array<{ quoteItemId: string | null; amount: { toString(): string } }>>;
    }>("patientPayment");
    const serviceIds = itemsPayload.map((item) => item.serviceId).filter(Boolean);
    const services =
      serviceClient?.findMany && serviceIds.length
        ? await serviceClient.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true, costBasis: true },
          })
        : [];
    const serviceMap = new Map(services.map((service) => [service.id, service]));

    const normalizedItems: NormalizedQuoteItem[] = itemsPayload.map((item) => {
      const quantityParsed = Number.parseInt(String(item.quantity), 10);
      const quantity = Number.isNaN(quantityParsed) || quantityParsed <= 0 ? 1 : quantityParsed;
      const priceParsed = Number.parseFloat(String(item.price).replace(",", "."));
      if (Number.isNaN(priceParsed)) {
        throw new Error("Prezzo non valido");
      }
      const service = serviceMap.get(item.serviceId);
      const serviceName = service?.name ?? "Prestazione";
      const total = Number((priceParsed * quantity).toFixed(2));
      
      // Check if user manually changed the price from default
      const defaultPrice = service ? Number(service.costBasis.toString()) : 0;
      const isManualAdjustment = Math.abs(priceParsed - defaultPrice) > 0.009;

      return {
        id: item.id?.trim() || null,
        serviceId: item.serviceId,
        serviceName,
        serviceDate: (() => {
          const serviceDate = new Date(`${String(item.serviceDate).trim()}T12:00:00.000Z`);
          if (Number.isNaN(serviceDate.getTime())) {
            throw new Error("Data prestazione non valida");
          }
          return serviceDate;
        })(),
        quantity,
        price: priceParsed,
        total,
        tooth: item.tooth,
        saldato: false,
        isManualAdjustment,
      };
    });

    let signatureUrl = existingSignatureUrl;
    if (signatureData?.startsWith("data:image/png")) {
      const signatureBuffer = Buffer.from(signatureData.replace(/^data:image\/png;base64,/, ""), "base64");
      const signatureName = `signatures/quotes/${patientId}/quote-${Date.now()}.png`;
      const signatureBlob = await put(signatureName, signatureBuffer, { access: "public", addRandomSuffix: false });
      signatureUrl = signatureBlob.url;
    }

    const totalSum = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const primaryItem = normalizedItems[0];
    let existingQuoteForUpdate: QuoteWithItemsForSave | null = null;
    let existingItemMap = new Map<string, QuoteWithItemsForSave["items"][number]>();
    let removableItems: QuoteWithItemsForSave["items"] = [];
    const paidByQuoteItemId = new Map<string, number>();

    if (quoteId) {
      const existingQuoteForSignature = await prisma.quote.findFirst({
        where: { id: quoteId, patientId },
        include: { items: true },
      });

      if (!existingQuoteForSignature) {
        throw new Error("Preventivo non trovato");
      }

      if (quoteItemsMatchPersisted(existingQuoteForSignature.items, normalizedItems)) {
        const quote = await prisma.quote.update({
          where: { id: existingQuoteForSignature.id },
          data: {
            serviceId: primaryItem.serviceId,
            serviceName: primaryItem.serviceName,
            serviceDate: primaryItem.serviceDate,
            quantity: primaryItem.quantity,
            price: new Prisma.Decimal(primaryItem.price),
            total: new Prisma.Decimal(totalSum),
            signatureUrl: signatureUrl ?? "",
            signedAt: new Date(),
          },
          select: { id: true },
        });

        await logAudit(user, {
          action: "patient.quote_saved",
          entity: "Patient",
          entityId: patientId,
          metadata: {
            quoteId: quote.id,
            serviceId: primaryItem.serviceId,
            serviceName: primaryItem.serviceName,
            quantity: primaryItem.quantity,
            price: primaryItem.price,
            total: totalSum,
          },
        });

        revalidatePath(`/pazienti/${patientId}`);
        revalidatePath("/finanza/pagamenti");
        return { savedAt: Date.now(), error: null };
      }

      existingQuoteForUpdate = existingQuoteForSignature;
      const existingPayments = patientPaymentClient?.findMany
        ? await patientPaymentClient.findMany({
            where: { quoteItemId: { in: existingQuoteForSignature.items.map((item) => item.id) } },
            select: { quoteItemId: true, amount: true },
          })
        : [];

      for (const payment of existingPayments) {
        if (!payment.quoteItemId) continue;
        paidByQuoteItemId.set(
          payment.quoteItemId,
          (paidByQuoteItemId.get(payment.quoteItemId) ?? 0) + Number(payment.amount.toString())
        );
      }

      existingItemMap = new Map(existingQuoteForSignature.items.map((item) => [item.id, item]));
      const incomingIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean));
      removableItems = existingQuoteForSignature.items.filter((item) => !incomingIds.has(item.id));
      const lockedRemovedItem = removableItems.find((item) => (paidByQuoteItemId.get(item.id) ?? 0) > 0);

      if (lockedRemovedItem) {
        throw new Error("Non puoi rimuovere una prestazione con pagamenti già registrati");
      }

      for (const item of normalizedItems) {
        if (!item.id) continue;
        const existingItem = existingItemMap.get(item.id);
        if (!existingItem) {
          throw new Error("Una riga del preventivo non è valida");
        }

        const paidAmount = paidByQuoteItemId.get(existingItem.id) ?? 0;
        if (paidAmount - item.total > 0.009) {
          throw new Error("Impossibile abbassare il totale: sono già presenti pagamenti per " + paidAmount.toFixed(2) + "€");
        }
      }
    }

    const quote = await prisma.$transaction(
      async (tx) => {
      if (!quoteId) {
        const createdQuote = await tx.quote.create({
          data: {
            patientId,
            serviceId: primaryItem.serviceId,
            serviceName: primaryItem.serviceName,
            serviceDate: primaryItem.serviceDate,
            quantity: primaryItem.quantity,
            price: new Prisma.Decimal(primaryItem.price),
            total: new Prisma.Decimal(totalSum),
            signatureUrl: signatureUrl ?? "",
            signedAt: new Date(),
            items: {
              create: normalizedItems.map((item) => ({
                serviceId: item.serviceId,
                serviceName: item.serviceName,
                serviceDate: item.serviceDate,
                quantity: item.quantity,
                price: new Prisma.Decimal(item.price),
                total: new Prisma.Decimal(item.total),
                saldato: item.saldato,
                isManualAdjustment: item.isManualAdjustment,
              })),
            },        },
        });

        await syncAllDentalRecordsIntoQuote(tx, patientId, createdQuote.id);

        return tx.quote.findUniqueOrThrow({
          where: { id: createdQuote.id },
        });
      }

      if (!existingQuoteForUpdate) {
        throw new Error("Preventivo non trovato");
      }

      await tx.quote.update({
        where: { id: existingQuoteForUpdate.id },
        data: {
          serviceId: primaryItem.serviceId,
          serviceName: primaryItem.serviceName,
          serviceDate: primaryItem.serviceDate,
          quantity: primaryItem.quantity,
          price: new Prisma.Decimal(primaryItem.price),
          total: new Prisma.Decimal(totalSum),
          signatureUrl: signatureUrl ?? "",
          signedAt: new Date(),
        },
      });

      for (const item of removableItems) {
        await tx.quoteItem.delete({ where: { id: item.id } });
      }

      for (const item of normalizedItems) {
        if (!item.id) {
          await tx.quoteItem.create({
            data: {
              quoteId: existingQuoteForUpdate.id,
              serviceId: item.serviceId,
              serviceName: item.serviceName,
              serviceDate: item.serviceDate,
              quantity: item.quantity,
              price: new Prisma.Decimal(item.price),
              total: new Prisma.Decimal(item.total),
              saldato: false,
              isManualAdjustment: item.isManualAdjustment,
            },
          });
          continue;
        }

        const existingItem = existingItemMap.get(item.id);
        if (!existingItem) continue;
        const paidAmount = paidByQuoteItemId.get(existingItem.id) ?? 0;
        
        const isSettled = paidAmount >= item.total - 0.009;

        await tx.quoteItem.update({
          where: { id: item.id },
          data: {
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            serviceDate: item.serviceDate,
            quantity: item.quantity,
            price: new Prisma.Decimal(item.price),
            total: new Prisma.Decimal(item.total),
            saldato: isSettled,
            isManualAdjustment: item.isManualAdjustment,
          },
        });
      }

      await syncAllDentalRecordsIntoQuote(tx, patientId, existingQuoteForUpdate.id);

      return tx.quote.findUniqueOrThrow({
        where: { id: existingQuoteForUpdate.id },
      });
    }, { timeout: 15000 });

    await logAudit(user, {
      action: "patient.quote_saved",
      entity: "Patient",
      entityId: patientId,
      metadata: {
        quoteId: quote.id,
        serviceId: primaryItem.serviceId,
        serviceName: primaryItem.serviceName,
        quantity: primaryItem.quantity,
        price: primaryItem.price,
        total: totalSum,
      },
    });

    revalidatePath(`/pazienti/${patientId}`);
    revalidatePath("/finanza/pagamenti");
    return { savedAt: Date.now(), error: null };
  } catch (error) {
    console.error("[savePreventivoAction] error", error);
    return { 
      savedAt: 0, 
      error: error instanceof Error ? error.message : "Errore interno durante il salvataggio" 
    };
  }
}

export async function revokeConsentAction(formData: FormData) {
  const user = await requireUser([...STAFF_ROLES]);
  const consentId = (formData.get("consentId") as string) ?? "";
  if (!consentId) throw new Error("Dati consenso non validi");

  const existing = await prisma.patientConsent.findUnique({
    where: { id: consentId },
    select: { patientId: true },
  });
  if (!existing) throw new Error("Consenso non trovato");

  await prisma.patientConsent.update({
    where: { id: consentId },
    data: { status: ConsentStatus.REVOKED, revokedAt: new Date() },
  });

  await logAudit(user, {
    action: "consent.revoked",
    entity: "Patient",
    entityId: existing.patientId,
    metadata: { consentId },
  });

  revalidatePath(`/pazienti/${existing.patientId}`);
  redirect(`/pazienti/${existing.patientId}?consentSuccess=${encodeURIComponent("Consenso revocato.")}`);
}
