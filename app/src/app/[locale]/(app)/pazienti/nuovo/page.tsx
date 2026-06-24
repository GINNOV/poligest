import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { createPatient } from "@/app/[locale]/(app)/pazienti/actions";
import { getAnamnesisConditions } from "@/lib/anamnesis";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { PatientCreateForm } from "@/components/patient-create-form";

export const metadata = createPageMetadata(PAGE_TITLES.nuovoPaziente);

export default async function NuovoPazientePage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const [doctors, consentModules, conditionsList] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.consentModule.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getAnamnesisConditions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registrazione paziente</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Compila per creare una nuova scheda paziente, includendo consenso e firma digitale.
          </p>
        </div>
        <Link
          href="/pazienti"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
        >
          Torna alla lista
        </Link>
      </div>

      <PatientCreateForm
        action={createPatient}
        doctors={doctors}
        consentModules={consentModules}
        conditionsList={conditionsList}
      />
    </div>
  );
}
