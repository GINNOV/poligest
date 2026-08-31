"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { logAudit } from "@/lib/audit";
import { ASSISTANT_ROLE } from "@/lib/roles";

const STAFF_ROLES = [Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY] as const;

export async function generateNextCertificateNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `CERT-${currentYear}-`;

  const latestCert = await prisma.medicalCertificate.findFirst({
    where: {
      certificateNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      certificateNumber: "desc",
    },
    select: {
      certificateNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestCert?.certificateNumber) {
    const rawNumberPart = latestCert.certificateNumber.replace(prefix, "").split("-")[0];
    const parsed = Number.parseInt(rawNumberPart, 10);
    if (!Number.isNaN(parsed)) {
      nextSequence = parsed + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, "0");
  return `${prefix}${paddedSequence}`;
}

export type CertificateSaveState = {
  success?: boolean;
  certificateId?: string;
  error?: string | null;
};

export async function saveMedicalCertificateAction(
  _: CertificateSaveState,
  formData: FormData
): Promise<CertificateSaveState> {
  try {
    const user = await requireUser([...STAFF_ROLES]);
    await requireFeatureAccess(user.role, "patients");

    const patientId = (formData.get("patientId") as string)?.trim();
    if (!patientId) {
      return { error: "Paziente non selezionato o non valido." };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!patient) {
      return { error: "Paziente non trovato." };
    }

    const doctorId = (formData.get("doctorId") as string)?.trim() || null;
    let doctorName = (formData.get("doctorName") as string)?.trim();

    if (doctorId && !doctorName) {
      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { fullName: true },
      });
      if (doctor) {
        doctorName = doctor.fullName;
      }
    }

    if (!doctorName) {
      doctorName = user.name || "Dott. Agovino & Angrisano";
    }

    const type = (formData.get("type") as string)?.trim() || "WORK_INCAPACITY";
    const title =
      (formData.get("title") as string)?.trim() ||
      "Certificato di Inabilità Temporanea al Lavoro e Riposo Medico";
    const content = (formData.get("content") as string)?.trim();

    if (!content) {
      return { error: "Il testo del certificato non può essere vuoto." };
    }

    const diagnosis = (formData.get("diagnosis") as string)?.trim() || null;
    const prognosisDaysRaw = formData.get("prognosisDays") as string;
    const prognosisDays = prognosisDaysRaw ? Number.parseInt(prognosisDaysRaw, 10) : null;

    const startDateRaw = formData.get("startDate") as string;
    const endDateRaw = formData.get("endDate") as string;
    const startDate = startDateRaw ? new Date(`${startDateRaw}T12:00:00.000Z`) : null;
    const endDate = endDateRaw ? new Date(`${endDateRaw}T12:00:00.000Z`) : null;

    const place = (formData.get("place") as string)?.trim() || "San Valentino Torio (SA)";
    const issuedAtRaw = formData.get("issuedAt") as string;
    const issuedAt = issuedAtRaw ? new Date(`${issuedAtRaw}T12:00:00.000Z`) : new Date();

    const signatureData = (formData.get("signatureData") as string)?.trim() || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    // Versioning check
    const rootCertificateId = (formData.get("rootCertificateId") as string)?.trim() || null;
    let certificateNumber: string;
    let version = 1;

    if (rootCertificateId) {
      const rootCert = await prisma.medicalCertificate.findUnique({
        where: { id: rootCertificateId },
        select: { id: true, certificateNumber: true, version: true, rootCertificateId: true },
      });

      if (!rootCert) {
        return { error: "Certificato di origine non trovato per il versionamento." };
      }

      const effectiveRootId = rootCert.rootCertificateId || rootCert.id;

      // Find maximum version for this root family
      const versions = await prisma.medicalCertificate.findMany({
        where: {
          OR: [{ id: effectiveRootId }, { rootCertificateId: effectiveRootId }],
        },
        select: { version: true },
        orderBy: { version: "desc" },
      });

      const maxVersion = versions[0]?.version ?? 1;
      version = maxVersion + 1;
      certificateNumber = rootCert.certificateNumber;

      // Mark earlier certificates as superseded
      await prisma.medicalCertificate.updateMany({
        where: {
          OR: [{ id: effectiveRootId }, { rootCertificateId: effectiveRootId }],
          status: "ISSUED",
        },
        data: {
          status: "SUPERSEDED",
        },
      });
    } else {
      certificateNumber = await generateNextCertificateNumber();
      version = 1;
    }

    const createdCert = await prisma.medicalCertificate.create({
      data: {
        certificateNumber,
        version,
        rootCertificateId: rootCertificateId
          ? (await prisma.medicalCertificate.findUnique({ where: { id: rootCertificateId } }))
              ?.rootCertificateId || rootCertificateId
          : null,
        patientId,
        doctorId,
        doctorName,
        type,
        title,
        content,
        diagnosis,
        prognosisDays: Number.isNaN(prognosisDays) ? null : prognosisDays,
        startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
        endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
        place,
        issuedAt: issuedAt && !Number.isNaN(issuedAt.getTime()) ? issuedAt : new Date(),
        signatureUrl: signatureData,
        signedAt: signatureData ? new Date() : null,
        status: "ISSUED",
        notes,
      },
    });

    await logAudit(user, {
      action: rootCertificateId ? "patient.certificate_version_created" : "patient.certificate_created",
      entity: "MedicalCertificate",
      entityId: createdCert.id,
      metadata: {
        certificateNumber: createdCert.certificateNumber,
        version: createdCert.version,
        patientId,
        type,
      },
    });

    revalidatePath("/pazienti/certificati");
    revalidatePath(`/pazienti/${patientId}`);
    revalidatePath("/pazienti");

    return {
      success: true,
      certificateId: createdCert.id,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Errore durante il salvataggio del certificato.",
    };
  }
}

export async function deleteMedicalCertificateAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  await requireFeatureAccess(user.role, "patients");

  const certificateId = (formData.get("certificateId") as string)?.trim();
  if (!certificateId) {
    throw new Error("ID certificato non specificato.");
  }

  const certificate = await prisma.medicalCertificate.findUnique({
    where: { id: certificateId },
    select: { id: true, certificateNumber: true, patientId: true },
  });

  if (!certificate) {
    throw new Error("Certificato non trovato.");
  }

  await prisma.medicalCertificate.delete({
    where: { id: certificateId },
  });

  await logAudit(user, {
    action: "patient.certificate_deleted",
    entity: "MedicalCertificate",
    entityId: certificateId,
    metadata: {
      certificateNumber: certificate.certificateNumber,
      patientId: certificate.patientId,
    },
  });

  revalidatePath("/pazienti/certificati");
  revalidatePath(`/pazienti/${certificate.patientId}`);
  redirect("/pazienti/certificati");
}

export async function getCertificatesList(params?: {
  search?: string;
  type?: string;
  patientId?: string;
}) {
  const search = params?.search?.trim();
  const type = params?.type?.trim();
  const patientId = params?.patientId?.trim();

  return prisma.medicalCertificate.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(type && type !== "ALL" ? { type } : {}),
      ...(search
        ? {
            OR: [
              { certificateNumber: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { diagnosis: { contains: search, mode: "insensitive" } },
              { doctorName: { contains: search, mode: "insensitive" } },
              {
                patient: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { taxId: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          taxId: true,
          phone: true,
          photoUrl: true,
          gender: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
          specialty: true,
        },
      },
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPatientCertificates(patientId: string) {
  return prisma.medicalCertificate.findMany({
    where: { patientId },
    include: {
      doctor: {
        select: {
          id: true,
          fullName: true,
          specialty: true,
        },
      },
    },
    orderBy: [{ issuedAt: "desc" }, { version: "desc" }],
  });
}
