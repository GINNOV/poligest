import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { InstructionManager } from "@/components/instruction-manager";

export default async function AdminInstructionsPage() {
  await requireUser([Role.ADMIN]);

  const instructions = await prisma.featureInstruction.findMany({
    include: {
      steps: {
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Amministrazione
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Istruzioni Funzionalità</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Configura guide passo-passo per le diverse sezioni dell'applicazione.
        </p>
      </div>

      <InstructionManager instructions={instructions} />
    </div>
  );
}
