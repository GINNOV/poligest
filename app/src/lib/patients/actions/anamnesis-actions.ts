"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AnamnesisConditionRecord = {
  id: string;
  label: string;
};

type AnamnesisClient = {
  create: (args: { data: { label: string } }) => Promise<AnamnesisConditionRecord>;
  update: (args: { where: { id: string }; data: { label: string } }) => Promise<AnamnesisConditionRecord>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  findMany: (args?: { orderBy?: { createdAt: "desc" | "asc" } }) => Promise<AnamnesisConditionRecord[]>;
};

function getAnamnesisClient() {
  const prismaModels = prisma as unknown as Record<string, AnamnesisClient | undefined>;
  const client = prismaModels["anamnesisCondition"];
  if (!client?.findMany) {
    throw new Error("Anamnesi non configurata. Esegui migrazioni Prisma e rigenera il client.");
  }
  return client;
}

export async function createAnamnesisConditionAction(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const label = (formData.get("label") as string)?.trim();

  if (!label) {
    throw new Error("Nome condizione obbligatorio");
  }

  const anamnesisClient = getAnamnesisClient();
  const condition = await anamnesisClient.create({
    data: { label },
  });

  await logAudit(admin, {
    action: "anamnesis_condition.created",
    entity: "AnamnesisCondition",
    entityId: condition.id,
    metadata: { label },
  });

  revalidatePath("/admin/anamnesi");
  revalidatePath("/pazienti/nuovo");
  revalidatePath("/pazienti/[id]", "page");
}

export async function updateAnamnesisConditionAction(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("conditionId") as string) || "";
  const label = (formData.get("label") as string)?.trim();

  if (!id || !label) {
    throw new Error("Dati condizione non validi");
  }

  const anamnesisClient = getAnamnesisClient();
  const condition = await anamnesisClient.update({
    where: { id },
    data: { label },
  });

  await logAudit(admin, {
    action: "anamnesis_condition.updated",
    entity: "AnamnesisCondition",
    entityId: condition.id,
    metadata: { label },
  });

  revalidatePath("/admin/anamnesi");
  revalidatePath("/pazienti/nuovo");
  revalidatePath("/pazienti/[id]", "page");
}

export async function deleteAnamnesisConditionAction(formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("conditionId") as string) || "";
  if (!id) throw new Error("Condizione non valida");

  const anamnesisClient = getAnamnesisClient();
  await anamnesisClient.delete({ where: { id } });

  await logAudit(admin, {
    action: "anamnesis_condition.deleted",
    entity: "AnamnesisCondition",
    entityId: id,
  });

  revalidatePath("/admin/anamnesi");
  revalidatePath("/pazienti/nuovo");
  revalidatePath("/pazienti/[id]", "page");
}
