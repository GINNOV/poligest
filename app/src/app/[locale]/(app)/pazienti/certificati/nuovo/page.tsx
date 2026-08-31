import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { CertificateForm } from "@/components/certificates/certificate-form";
import type { CertificateType } from "@/lib/certificates/templates";

export const metadata = createPageMetadata(PAGE_TITLES.nuovoCertificato);

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const resolved = await searchParams;
  const patientIdParam = typeof resolved.patientId === "string" ? resolved.patientId : undefined;
  const rootIdParam = typeof resolved.rootId === "string" ? resolved.rootId : undefined;

  // Fetch active patients
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      taxId: true,
      birthDate: true,
      notes: true,
      phone: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Fetch doctors
  const doctors = await prisma.doctor.findMany({
    select: {
      id: true,
      fullName: true,
      specialty: true,
    },
    orderBy: { fullName: "asc" },
  });

  let rootCertificate = null;
  if (rootIdParam) {
    rootCertificate = await prisma.medicalCertificate.findUnique({
      where: { id: rootIdParam },
      include: {
        patient: true,
      },
    });
  }

  // Pre-fill parameters if versioning an existing certificate
  const initialPatientId = rootCertificate?.patientId || patientIdParam;
  const initialData = rootCertificate
    ? {
        certificateNumber: rootCertificate.certificateNumber,
        version: rootCertificate.version,
        type: rootCertificate.type as CertificateType,
        title: rootCertificate.title,
        content: rootCertificate.content,
        diagnosis: rootCertificate.diagnosis,
        prognosisDays: rootCertificate.prognosisDays,
        startDate: rootCertificate.startDate?.toISOString() || null,
        endDate: rootCertificate.endDate?.toISOString() || null,
        place: rootCertificate.place,
        notes: rootCertificate.notes,
        signatureUrl: rootCertificate.signatureUrl,
      }
    : undefined;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Title */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/pazienti" className="hover:text-emerald-700 dark:hover:text-emerald-400">
            Pazienti
          </Link>
          <span>/</span>
          <Link
            href="/pazienti/certificati"
            className="hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Certificati
          </Link>
          <span>/</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {rootCertificate ? "Nuova Versione" : "Nuovo"}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {rootCertificate
            ? `Emetti Nuova Versione: ${rootCertificate.certificateNumber}`
            : "Emetti Certificato Medico"}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Compila i dati del certificato. Il testo è generato automaticamente e modificabile a piacere.
        </p>
      </div>

      <CertificateForm
        patients={patients.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          taxId: p.taxId,
          birthDate: p.birthDate ? p.birthDate.toISOString() : null,
          phone: p.phone,
        }))}
        doctors={doctors}
        initialPatientId={initialPatientId}
        initialDoctorId={rootCertificate?.doctorId || undefined}
        currentUserName={user.name || undefined}
        rootCertificateId={rootCertificate ? rootCertificate.id : undefined}
        initialData={initialData}
      />
    </div>
  );
}
