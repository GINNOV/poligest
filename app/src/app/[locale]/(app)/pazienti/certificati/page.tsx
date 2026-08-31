import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { getCertificatesList } from "@/lib/patients/actions/certificates-actions";
import {
  CertificatesTable,
  type CertificateListItem,
} from "@/components/certificates/certificates-table";
import { CertificatesFilters } from "@/components/certificates/certificates-filters";

export const metadata = createPageMetadata(PAGE_TITLES.certificati);

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");
  const canDelete = user.role === Role.ADMIN || user.role === Role.MANAGER;

  const resolved = await searchParams;
  const search = typeof resolved.search === "string" ? resolved.search : undefined;
  const type = typeof resolved.type === "string" ? resolved.type : undefined;

  const certificates = (await getCertificatesList({
    search,
    type,
  })) as unknown as CertificateListItem[];

  const totalCertificates = certificates.length;
  const workIncapacityCount = certificates.filter((c) => c.type === "WORK_INCAPACITY").length;
  const attendanceCount = certificates.filter((c) => c.type === "ATTENDANCE").length;
  const insuranceCount = certificates.filter((c) => c.type === "INSURANCE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/pazienti" className="hover:text-emerald-700 dark:hover:text-emerald-400">
              Pazienti
            </Link>
            <span>/</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Certificati</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Certificati Medici
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Emissione, archivio e versionamento dei certificati medici con firma digitale per datori di lavoro e assicurazioni.
          </p>
        </div>

        <Link
          href="/pazienti/certificati/nuovo"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Nuovo Certificato
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Totale Emessi
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {totalCertificates}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Riposo Lavorativo
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-200">
            {workIncapacityCount}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 shadow-sm dark:border-sky-900/30 dark:bg-sky-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
            Presenza Cure
          </p>
          <p className="mt-1 text-2xl font-bold text-sky-950 dark:text-sky-200">
            {attendanceCount}
          </p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm dark:border-purple-900/30 dark:bg-purple-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300">
            Assicurazioni
          </p>
          <p className="mt-1 text-2xl font-bold text-purple-950 dark:text-purple-200">
            {insuranceCount}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <CertificatesFilters />

      {/* Certificates List */}
      <CertificatesTable certificates={certificates} canDelete={canDelete} />
    </div>
  );
}
