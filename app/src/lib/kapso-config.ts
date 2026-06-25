import "server-only";

import { prisma } from "@/lib/prisma";

export const KAPSO_WHATSAPP_CONFIG_ID = "kapso";

export type KapsoWhatsAppConfig = {
  apiKey: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  source: "db" | "env";
};

let cachedConfig: { value: KapsoWhatsAppConfig | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0,
};

function readEnvKapsoConfig(): KapsoWhatsAppConfig | null {
  const apiKey = process.env.KAPSO_API_KEY?.trim() || "";
  const phoneNumberId = process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  const displayPhoneNumber = process.env.KAPSO_WHATSAPP_DISPLAY_PHONE_NUMBER?.trim() || null;

  if (!apiKey || !phoneNumberId) return null;

  return {
    apiKey,
    phoneNumberId,
    displayPhoneNumber,
    source: "env",
  };
}

export function clearKapsoWhatsAppConfigCache() {
  cachedConfig = { value: null, fetchedAt: 0 };
}

export async function getKapsoWhatsAppConfig(): Promise<KapsoWhatsAppConfig | null> {
  const now = Date.now();
  if (cachedConfig.value && now - cachedConfig.fetchedAt < 5 * 60 * 1000) {
    return cachedConfig.value;
  }

  const dbConfig = await prisma.kapsoWhatsAppConfig.findUnique({
    where: { id: KAPSO_WHATSAPP_CONFIG_ID },
  });

  const value: KapsoWhatsAppConfig | null = dbConfig
    ? {
        apiKey: dbConfig.apiKey,
        phoneNumberId: dbConfig.phoneNumberId,
        displayPhoneNumber: dbConfig.displayPhoneNumber,
        source: "db",
      }
    : readEnvKapsoConfig();

  cachedConfig = { value, fetchedAt: now };
  return value;
}

export function maskKapsoValue(value?: string | null, show = 4) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= show) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, show)}${"*".repeat(Math.max(0, trimmed.length - show - 2))}${trimmed.slice(-2)}`;
}