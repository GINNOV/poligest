import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { getKapsoWhatsAppConfig } from "@/lib/kapso-config";
import { normalizeItalianPhone } from "@/lib/phone";

const DEFAULT_KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp";

export async function isKapsoWhatsAppConfigured() {
  const config = await getKapsoWhatsAppConfig();
  return Boolean(config?.apiKey && config?.phoneNumberId);
}

async function getKapsoRuntimeConfig() {
  const config = await getKapsoWhatsAppConfig();
  if (!config?.apiKey || !config.phoneNumberId) {
    throw new Error("Configurazione WhatsApp Kapso mancante.");
  }
  return config;
}

export async function sendKapsoWhatsAppText(params: { to: string; body: string }) {
  const phone = normalizeItalianPhone(params.to);
  if (!phone) {
    throw new Error("Numero WhatsApp non valido.");
  }

  const config = await getKapsoRuntimeConfig();
  const client = new WhatsAppClient({
    baseUrl: process.env.KAPSO_API_BASE_URL?.trim() || DEFAULT_KAPSO_BASE_URL,
    kapsoApiKey: config.apiKey,
  });

  await client.messages.sendText({
    phoneNumberId: config.phoneNumberId,
    to: phone,
    body: params.body,
  });
}