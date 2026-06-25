"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  KAPSO_WHATSAPP_CONFIG_ID,
  clearKapsoWhatsAppConfigCache,
} from "@/lib/kapso-config";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";

export type WhatsAppAdminFormState = {
  success?: boolean;
  error?: string;
};

export async function saveKapsoWhatsAppConfig(
  formData: FormData,
): Promise<WhatsAppAdminFormState> {
  try {
    await requireUser([Role.ADMIN]);

    const apiKeyInput = (formData.get("apiKey") as string)?.trim();
    const phoneNumberId = (formData.get("phoneNumberId") as string)?.trim();
    const displayPhoneNumber = (formData.get("displayPhoneNumber") as string)?.trim() || null;

    const existing = await prisma.kapsoWhatsAppConfig.findUnique({
      where: { id: KAPSO_WHATSAPP_CONFIG_ID },
    });

    const apiKey = apiKeyInput || existing?.apiKey || "";
    if (!apiKey || !phoneNumberId) {
      return { error: "Inserisci token API e ID numero WhatsApp." };
    }

    await prisma.kapsoWhatsAppConfig.upsert({
      where: { id: KAPSO_WHATSAPP_CONFIG_ID },
      update: {
        ...(apiKeyInput ? { apiKey: apiKeyInput } : {}),
        phoneNumberId,
        displayPhoneNumber,
      },
      create: {
        id: KAPSO_WHATSAPP_CONFIG_ID,
        apiKey,
        phoneNumberId,
        displayPhoneNumber,
      },
    });

    clearKapsoWhatsAppConfigCache();
    revalidatePath("/admin/whatsapp");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Salvataggio non riuscito.",
    };
  }
}

export async function sendTestWhatsApp(formData: FormData): Promise<WhatsAppAdminFormState> {
  try {
    await requireUser([Role.ADMIN]);

    const to = (formData.get("to") as string)?.trim();
    const body =
      (formData.get("body") as string)?.trim() ||
      "Messaggio di test dal pannello WhatsApp Kapso.";

    if (!to) {
      return { error: "Inserisci un numero di telefono." };
    }

    await sendKapsoWhatsAppText({ to, body });
    revalidatePath("/admin/whatsapp");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invio WhatsApp non riuscito.",
    };
  }
}