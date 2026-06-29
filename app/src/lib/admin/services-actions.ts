"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

function parseCostBasis(raw: string) {
  const cost = Number.parseFloat(raw.replace(",", "."));
  if (Number.isNaN(cost)) {
    throw new Error("Costo base non valido");
  }
  return cost;
}

export async function createService(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const costBasisRaw = (formData.get("costBasis") as string)?.trim();

  if (!name || !costBasisRaw) {
    throw new Error("Nome e costo base sono obbligatori");
  }

  const cost = parseCostBasis(costBasisRaw);

  const service = await prisma.service.create({
    data: {
      name,
      description,
      costBasis: new Prisma.Decimal(cost),
    },
  });

  await logAudit(admin, {
    action: "service.created",
    entity: "Service",
    entityId: service.id,
    metadata: { name, costBasis: cost },
  });

  revalidatePath("/admin/servizi");
}

export async function updateService(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("serviceId") as string) || "";
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const costBasisRaw = (formData.get("costBasis") as string)?.trim();

  if (!id || !name || !costBasisRaw) {
    throw new Error("Dati servizio non validi");
  }

  const cost = parseCostBasis(costBasisRaw);

  const service = await prisma.service.update({
    where: { id },
    data: {
      name,
      description,
      costBasis: new Prisma.Decimal(cost),
    },
  });

  await logAudit(admin, {
    action: "service.updated",
    entity: "Service",
    entityId: service.id,
    metadata: { name, costBasis: cost },
  });

  revalidatePath("/admin/servizi");
}

export async function deleteService(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("serviceId") as string) || "";
  if (!id) throw new Error("Servizio non valido");

  await prisma.service.delete({ where: { id } });

  await logAudit(admin, {
    action: "service.deleted",
    entity: "Service",
    entityId: id,
  });

  revalidatePath("/admin/servizi");
}