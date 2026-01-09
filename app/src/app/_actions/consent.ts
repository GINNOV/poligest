"use server";

import { ConsentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addConsentAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const patientId = (formData.get("patientId") as string) ?? "";
  const moduleId = (formData.get("consentModuleId") as string) ?? "";
  const channel = ((formData.get("consentChannel") as string) ?? "Di persona").trim() || "Di persona";
  const expiresAtStr = (formData.get("consentExpiresAt") as string) ?? "";
  const consentPlace = (formData.get("consentPlace") as string)?.trim();
  const consentDate = (formData.get("consentDate") as string)?.trim();
  const patientSignature = (formData.get("patientSignature") as string)?.trim();
  const doctorSignature = (formData.get("doctorSignature") as string)?.trim();
  const consentSignatureData = (formData.get("consentSignatureData") as string)?.trim();

  let signatureUrl: string | null = null;
  try {
    if (!patientId || !moduleId) {
      throw new Error("Dati consenso non validi");
    }

    if (!patientSignature) {
      throw new Error("Inserisci il nome leggibile del paziente.");
    }

    if (!consentSignatureData) {
      throw new Error("Acquisisci la firma digitale del paziente.");
    }

    const module = await prisma.consentModule.findFirst({
      where: { id: moduleId, active: true },
      select: { id: true, name: true },
    });
    if (!module) {
      throw new Error("Modulo consenso non valido o disattivato.");
    }

    const givenAt = new Date();
    const signedOn = consentDate ? new Date(consentDate) : null;
    if (signedOn && Number.isNaN(signedOn.getTime())) {
      throw new Error("Data consenso non valida.");
    }
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("Data scadenza non valida.");
    }
    const signatureBase64 = consentSignatureData.startsWith("data:image/")
      ? consentSignatureData.replace(/^data:image\/png;base64,/, "")
      : consentSignatureData;
    const signatureBuffer = Buffer.from(signatureBase64, "base64");
    signatureUrl = consentSignatureData.startsWith("data:image/")
      ? consentSignatureData
      : `data:image/png;base64,${signatureBase64}`;

    const existing = await prisma.patientConsent.findUnique({
      where: { patientId_moduleId: { patientId, moduleId: module.id } },
    });

    if (existing && existing.status !== ConsentStatus.REVOKED) {
      throw new Error("Esiste già un consenso attivo per questo modulo.");
    }

    if (existing) {
      await prisma.patientConsent.update({
        where: { id: existing.id },
        data: {
          status: ConsentStatus.GRANTED,
          channel,
          givenAt,
          signedOn,
          expiresAt,
          signatureUrl,
          place: consentPlace || null,
          patientName: patientSignature || null,
          doctorName: doctorSignature || null,
          revokedAt: null,
        },
      });
    } else {
      await prisma.patientConsent.create({
        data: {
          patientId,
          moduleId: module.id,
          status: ConsentStatus.GRANTED,
          channel,
          givenAt,
          signedOn,
          expiresAt,
          signatureUrl,
          place: consentPlace || null,
          patientName: patientSignature || null,
          doctorName: doctorSignature || null,
        } as any,
      });
    }

    await logAudit(user, {
      action: "consent.added",
      entity: "Patient",
      entityId: patientId,
      metadata: {
        moduleId: module.id,
        moduleName: module.name,
        status: ConsentStatus.GRANTED,
        channel,
        consentPlace,
        consentDate,
        patientSignature,
        doctorSignature,
        signature: signatureUrl,
      },
    });

    revalidatePath(`/pazienti/${patientId}`);
    redirect(`/pazienti/${patientId}?consentSuccess=${encodeURIComponent("Consenso aggiunto correttamente.")}`);
  } catch (err: any) {
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const isUnique = err?.code === "P2002";
    const message = isUnique
      ? "Esiste già un consenso per questo modulo per questo paziente."
      : err?.message ?? "Impossibile aggiungere il consenso.";
    redirect(`/pazienti/${patientId || ""}?consentError=${encodeURIComponent(message)}`);
  }
}
