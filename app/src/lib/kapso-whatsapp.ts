import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { normalizeItalianPhone } from "@/lib/phone";

const DEFAULT_KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp";

export function isKapsoWhatsAppConfigured() {
  return Boolean(
    process.env.KAPSO_API_KEY?.trim() && process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

function getKapsoWhatsAppClient() {
  const apiKey = process.env.KAPSO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("KAPSO_API_KEY non configurata.");
  }

  return new WhatsAppClient({
    baseUrl: process.env.KAPSO_API_BASE_URL?.trim() || DEFAULT_KAPSO_BASE_URL,
    kapsoApiKey: apiKey,
  });
}

function getKapsoPhoneNumberId() {
  const phoneNumberId = process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) {
    throw new Error("KAPSO_WHATSAPP_PHONE_NUMBER_ID non configurata.");
  }
  return phoneNumberId;
}

export async function sendKapsoWhatsAppText(params: { to: string; body: string }) {
  const phone = normalizeItalianPhone(params.to);
  if (!phone) {
    throw new Error("Numero WhatsApp non valido.");
  }

  const client = getKapsoWhatsAppClient();
  await client.messages.sendText({
    phoneNumberId: getKapsoPhoneNumberId(),
    to: phone,
    body: params.body,
  });
}