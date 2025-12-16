"use server";

import fs from "fs/promises";
import path from "path";
import { ConsentStatus, ConsentType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addConsentAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const patientId = (formData.get("patientId") as string) ?? "";
  const type = formData.get("consentType") as ConsentType;
  const channel = ((formData.get("consentChannel") as string) ?? "manual").trim() || "manual";
  const expiresAtStr = (formData.get("consentExpiresAt") as string) ?? "";
  const consentAgreement = formData.get("consentAgreement") === "on";
  const consentPlace = (formData.get("consentPlace") as string)?.trim();
  const consentDate = (formData.get("consentDate") as string)?.trim();
  const patientSignature = (formData.get("patientSignature") as string)?.trim();
  const doctorSignature = (formData.get("doctorSignature") as string)?.trim();
  const consentSignatureData = (formData.get("consentSignatureData") as string)?.trim();

  try {
    if (!patientId || !type || !Object.values(ConsentType).includes(type) || !consentAgreement) {
      throw new Error("Dati consenso non validi");
    }

    if (!consentSignatureData) {
      throw new Error("Acquisisci la firma digitale del paziente.");
    }

    const givenAt = new Date();
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
    const signatureBuffer = Buffer.from(
      consentSignatureData.replace(/^data:image\/png;base64,/, ""),
      "base64"
    );

    const consent = await prisma.consent.create({
      data: {
        patientId,
        type,
        status: ConsentStatus.GRANTED,
        channel,
        givenAt,
        expiresAt,
      },
    });

    const sigDir = path.join(process.cwd(), "public", "uploads", "signatures");
    await fs.mkdir(sigDir, { recursive: true });
    const sigPath = path.join(sigDir, `consent-${consent.id}.png`);
    await fs.writeFile(sigPath, signatureBuffer);
    const sigPublicPath = `/uploads/signatures/consent-${consent.id}.png?ts=${Date.now()}`;

    await logAudit(user, {
      action: "consent.added",
      entity: "Patient",
      entityId: patientId,
      metadata: {
        type,
        status: ConsentStatus.GRANTED,
        channel,
        consentPlace,
        consentDate,
        patientSignature,
        doctorSignature,
        signature: sigPublicPath,
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
      ? "Esiste già un consenso di questo tipo per questo paziente."
      : err?.message ?? "Impossibile aggiungere il consenso.";
    redirect(`/pazienti/${patientId || ""}?consentError=${encodeURIComponent(message)}`);
  }
}
