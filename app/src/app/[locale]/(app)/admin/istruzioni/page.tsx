import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { InstructionManager } from "@/components/instruction-manager";

export const metadata = createPageMetadata(PAGE_TITLES.istruzioni);

export default async function AdminInstructionsPage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);

  const instructions = await prisma.featureInstruction.findMany({
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <InstructionManager
        instructions={instructions}
        showAdminBackLink={user.role === Role.ADMIN}
      />
    </div>
  );
}
