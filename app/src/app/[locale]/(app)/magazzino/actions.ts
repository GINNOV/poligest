"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role, StockMovementType } from "@prisma/client";

export async function updateProduct(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const id = formData.get("productId") as string;
  const name = (formData.get("name") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim() || null;
  const serviceType = (formData.get("serviceType") as string)?.trim() || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  const minThreshold = Number(formData.get("minThreshold")) || 0;
  const supplierId = (formData.get("supplierId") as string) || null;

  if (!id || !name) throw new Error("Dati prodotto non validi");

  await prisma.product.update({
    where: { id },
    data: { name, sku, serviceType, udiDi, minThreshold, supplierId },
  });

  revalidatePath("/magazzino");
}

export async function updateSupplier(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const id = formData.get("supplierId") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!id || !name) throw new Error("Dati fornitore non validi");

  await prisma.supplier.update({
    where: { id },
    data: { name, email, phone, notes },
  });

  revalidatePath("/magazzino");
}

export async function deleteProduct(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const productId = formData.get("productId") as string;
  if (!productId) return;

  try {
    // Ripulisci movimenti collegati per evitare vincoli FK
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  } catch (err) {
    throw err;
  }

  revalidatePath("/magazzino");
}

export async function deleteSupplier(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const supplierId = formData.get("supplierId") as string;
  if (!supplierId) return;

  try {
    // Scollega i prodotti da questo fornitore per evitare blocchi sui FK
    await prisma.product.updateMany({
      where: { supplierId },
      data: { supplierId: null },
    });
    await prisma.supplier.delete({ where: { id: supplierId } });
  } catch (err) {
    throw err;
  }

  revalidatePath("/magazzino");
}

export async function createSupplier(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!name) throw new Error("Nome fornitore obbligatorio");

  await prisma.supplier.create({ data: { name, email, phone, notes } });
  revalidatePath("/magazzino");
}

export async function createProduct(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim() || null;
  const serviceType = (formData.get("serviceType") as string)?.trim() || null;
  const unitCostRaw = (formData.get("unitCost") as string)?.trim();
  const minThreshold = Number(formData.get("minThreshold")) || 0;
  const supplierId = (formData.get("supplierId") as string) || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  if (!name) throw new Error("Nome prodotto obbligatorio");

  await prisma.product.create({
    data: {
      name,
      sku,
      serviceType,
      unitCost: unitCostRaw ? unitCostRaw : null,
      minThreshold,
      supplierId,
      udiDi,
    },
  });

  revalidatePath("/magazzino");
}

export async function addStockMovement(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const productId = formData.get("productId") as string;
  const quantity = Number(formData.get("quantity"));
  const movement = formData.get("movement") as StockMovementType;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!productId || !movement || Number.isNaN(quantity) || quantity === 0) {
    throw new Error("Dati movimento non validi");
  }

  await prisma.stockMovement.create({
    data: {
      productId,
      quantity: Math.abs(quantity),
      movement,
      note,
      userId: user.id,
    },
  });

  revalidatePath("/magazzino");
}

export async function deleteStockMovement(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const movementId = formData.get("movementId") as string;
  if (!movementId) return;

  await prisma.stockMovement.delete({ where: { id: movementId } });

  revalidatePath("/magazzino");
}

export async function updateStockMovement(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const movementId = formData.get("movementId") as string;
  const quantity = Number(formData.get("quantity"));
  const movement = formData.get("movement") as StockMovementType;
  const note = (formData.get("note") as string)?.trim() || null;

  if (!movementId || !movement || Number.isNaN(quantity) || quantity === 0) {
    throw new Error("Dati movimento non validi");
  }

  await prisma.stockMovement.update({
    where: { id: movementId },
    data: {
      quantity: Math.abs(quantity),
      movement,
      note,
      userId: user.id,
    },
  });

  revalidatePath("/magazzino");
}

export async function importStockFromCSV(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("File mancante o vuoto");

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  const parseDate = (str: string): Date | null => {
    if (!str) return null;
    str = str.trim();
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [d, m, y] = str.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    const months = {
      gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5,
      lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
    };
    const parts = str.toLowerCase().split(/[.\-\s]+/);
    if (parts.length >= 2) {
      const mStr = parts.find((p) => months[p as keyof typeof months] !== undefined);
      const yStr = parts.find((p) => p.match(/^\d{2,4}$/));
      
      if (mStr && yStr) {
        let y = Number(yStr);
        if (y < 100) y += 2000;
        const m = months[mStr as keyof typeof months];
        return new Date(y, m, 1);
      }
    }
    return null;
  };

  // Find header row index intelligently
  const headerIdx = lines.findIndex(l => 
    l.toLowerCase().includes("paziente") && 
    (l.toLowerCase().includes("tipo di dm") || l.toLowerCase().includes("marca"))
  );
  
  const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(";").map((c) => c.trim());
    if (cols.length < 2) continue;

    const [
      patientNameRaw,
      type,
      brand,
      purchaseDateRaw,
      udiDi,
      udiPi,
      interventionDateRaw,
      site,
    ] = cols;

    if (!patientNameRaw) continue;

    const nameParts = patientNameRaw.split(/\s+/);
    let patient = null;
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      patient = await prisma.patient.findFirst({
        where: {
          OR: [
            { firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } },
            { firstName: { equals: lastName, mode: "insensitive" }, lastName: { equals: firstName, mode: "insensitive" } },
          ],
        },
      });
      if (!patient) {
        patient = await prisma.patient.create({ data: { firstName, lastName } });
      }
    } else {
      patient = await prisma.patient.create({ data: { firstName: patientNameRaw, lastName: "" } });
    }

    let supplier = null;
    if (brand) {
      supplier = await prisma.supplier.findFirst({ where: { name: { equals: brand, mode: "insensitive" } } });
      if (!supplier) {
        supplier = await prisma.supplier.create({ data: { name: brand } });
      }
    }

    const productName = `${type || "Dispositivo"} ${brand || ""}`.trim();
    
    let product: { id: string; udiDi: string | null } | null = null;

    // 1. Try strict match by UDI-DI
    if (udiDi) {
      product = await prisma.product.findFirst({ where: { udiDi: { equals: udiDi, mode: "insensitive" } } });
    }

    // 2. If not found by UDI-DI, try fuzzy match by name
    if (!product) {
      const candidate = await prisma.product.findFirst({ 
        where: { 
          name: { equals: productName, mode: "insensitive" },
          serviceType: { equals: type, mode: "insensitive" }
        } 
      });

      if (candidate) {
        if (udiDi && !candidate.udiDi) {
           // Upgrade generic product to specific UDI-DI
           product = await prisma.product.update({
             where: { id: candidate.id },
             data: { udiDi: udiDi }
           });
        } else if (!udiDi) {
           // Both have no UDI-DI, match confirmed
           product = candidate;
        } 
        // Else: Candidate has UDI-DI A, we have UDI-DI B (or none). Treat as different.
      }
    }

    // 3. Create new if still not found
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: productName,
          serviceType: type,
          supplierId: supplier?.id,
          udiDi: udiDi || null,
        },
      });
    }

    const pDate = parseDate(purchaseDateRaw);
    const iDate = parseDate(interventionDateRaw);

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        quantity: 1,
        movement: "OUT",
        userId: user.id,
        udiPi: udiPi || null,
        interventionDate: iDate,
        interventionSite: site || null,
        patientId: patient.id,
        purchaseDate: pDate,
      },
    });
  }

  revalidatePath("/magazzino");
}
