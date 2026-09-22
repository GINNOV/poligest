"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseInstructionStepsPayload, validateInstructionInput } from "@/lib/instructions/domain";

const EDITORS = [Role.ADMIN, Role.MANAGER];

export async function upsertInstructionAction(formData: FormData) {
  const user = await requireUser(EDITORS);

  const id = (formData.get("id") as string | null)?.trim() || null;
  const rawPathPattern = (formData.get("pathPattern") as string) || "";
  const role = (formData.get("role") as string | null) || null;
  const rawTitle = (formData.get("title") as string) || "";
  const description = (formData.get("description") as string | null) || "";
  const category = (formData.get("category") as string | null) || null;
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  const steps = parseInstructionStepsPayload(formData.get("stepsJson"));
  const validated = validateInstructionInput({
    rawPathPattern,
    title: rawTitle,
    description,
    category,
    role,
    isActive,
    steps,
  });

  const result = await prisma.$transaction(async (tx) => {
    let instructionId = id;

    if (id) {
      await tx.featureInstruction.update({
        where: { id },
        data: {
          pathPattern: validated.pathPattern,
          role: validated.role,
          title: validated.title,
          description: validated.description,
          category: validated.category,
          isActive: validated.isActive,
        },
      });
      await tx.featureInstructionStep.deleteMany({
        where: { instructionId: id },
      });
    } else {
      const created = await tx.featureInstruction.create({
        data: {
          pathPattern: validated.pathPattern,
          role: validated.role,
          title: validated.title,
          description: validated.description,
          category: validated.category,
          isActive: validated.isActive,
          sortOrder: 0,
        },
      });
      instructionId = created.id;
    }

    if (validated.steps.length > 0) {
      await tx.featureInstructionStep.createMany({
        data: validated.steps.map((step) => ({
          ...(step.id ? { id: step.id } : {}),
          instructionId: instructionId!,
          title: step.title,
          content: step.content,
          youtubeUrl: step.youtubeUrl,
          sortOrder: step.sortOrder,
        })),
      });
    }

    return instructionId;
  });

  await logAudit(user, {
    action: id ? "instruction.updated" : "instruction.created",
    entity: "FeatureInstruction",
    entityId: result!,
    metadata: { title: validated.title, pathPattern: validated.pathPattern },
  });

  revalidatePath("/admin/istruzioni");
  return { success: true };
}

export async function deleteInstructionAction(formData: FormData) {
  const user = await requireUser(EDITORS);
  const id = formData.get("id") as string;

  await prisma.featureInstruction.delete({
    where: { id },
  });

  await logAudit(user, {
    action: "instruction.deleted",
    entity: "FeatureInstruction",
    entityId: id,
  });

  revalidatePath("/admin/istruzioni");
  return { success: true };
}
