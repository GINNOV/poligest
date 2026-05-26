"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseInstructionStepsPayload } from "@/lib/instructions/domain";

export async function upsertInstructionAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN]);
  
  const id = formData.get("id") as string | null;
  const pathPattern = formData.get("pathPattern") as string;
  const role = formData.get("role") as Role | null;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const isActive = formData.get("isActive") === "on";
  
  const steps = parseInstructionStepsPayload(formData.get("stepsJson"));

  const data = {
    pathPattern,
    role: role || null,
    title,
    description,
    isActive,
  };

  const result = await prisma.$transaction(async (tx) => {
    let instructionId = id;
    
    if (id) {
      await tx.featureInstruction.update({
        where: { id },
        data,
      });
      
      // Delete steps not in the new list
      const incomingStepIds = steps.map(s => s.id).filter(Boolean) as string[];
      await tx.featureInstructionStep.deleteMany({
        where: {
          instructionId: id,
          id: { notIn: incomingStepIds }
        }
      });
    } else {
      const created = await tx.featureInstruction.create({
        data,
      });
      instructionId = created.id;
    }

    // Upsert steps
    for (const step of steps) {
      if (step.id) {
        await tx.featureInstructionStep.update({
          where: { id: step.id },
          data: {
            title: step.title,
            content: step.content,
            sortOrder: step.sortOrder,
          }
        });
      } else {
        await tx.featureInstructionStep.create({
          data: {
            instructionId: instructionId!,
            title: step.title,
            content: step.content,
            sortOrder: step.sortOrder,
          }
        });
      }
    }
    
    return instructionId;
  });

  await logAudit(user, {
    action: id ? "instruction.updated" : "instruction.created",
    entity: "FeatureInstruction",
    entityId: result!,
    metadata: { title, pathPattern },
  });

  revalidatePath("/admin/istruzioni");
  return { success: true };
}

export async function deleteInstructionAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN]);
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

export async function markStepAsDoneAction(instructionId: string, stepId: string) {
  const user = await requireUser();
  
  const step = await prisma.featureInstructionStep.findUniqueOrThrow({
    where: { id: stepId },
    include: { instruction: { include: { steps: { orderBy: { sortOrder: 'asc' } } } } }
  });

  if (step.instructionId !== instructionId) {
    throw new Error("Passaggio istruzione non valido");
  }

  const lastStepId = step.instruction.steps.at(-1)?.id;
  if (!lastStepId) {
    throw new Error("Istruzione senza passaggi");
  }

  const isLastStep = lastStepId === stepId;

  await prisma.userInstructionProgress.upsert({
    where: {
      user_instruction_unique: {
        userId: user.id,
        instructionId,
      }
    },
    create: {
      userId: user.id,
      instructionId,
      lastStepId: stepId,
      completedAt: isLastStep ? new Date() : null,
    },
    update: {
      lastStepId: stepId,
      completedAt: isLastStep ? new Date() : null,
    }
  });

  return { success: true };
}

export async function resetProgressAction(instructionId: string) {
  const user = await requireUser();

  await prisma.userInstructionProgress.deleteMany({
    where: {
      userId: user.id,
      instructionId,
    }
  });

  return { success: true };
}
