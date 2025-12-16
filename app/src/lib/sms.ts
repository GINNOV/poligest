import { prisma } from "@/lib/prisma";

type SendSmsOptions = {
  to: string;
  body: string;
  templateId?: string | null;
  patientId?: string | null;
  userId?: string | null;
};

const envClickSendUser = process.env.CLICKSEND_USERNAME;
const envClickSendKey = process.env.CLICKSEND_API_KEY;
const envClickSendFrom = process.env.CLICKSEND_FROM;

type ClickSendConfig = {
  username: string;
  apiKey: string;
  from?: string | null;
  source: "db" | "env";
};

let cachedConfig: { value: ClickSendConfig | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0,
};

async function getClickSendConfig(): Promise<ClickSendConfig | null> {
  const now = Date.now();
  if (cachedConfig.value && now - cachedConfig.fetchedAt < 5 * 60 * 1000) {
    return cachedConfig.value;
  }

  const dbConfig = await prisma.smsProviderConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const value: ClickSendConfig | null = dbConfig
    ? {
        username: dbConfig.username,
        apiKey: dbConfig.apiKey,
        from: dbConfig.from,
        source: "db",
      }
    : envClickSendUser && envClickSendKey
      ? {
          username: envClickSendUser,
          apiKey: envClickSendKey,
          from: envClickSendFrom,
          source: "env",
        }
      : null;

  cachedConfig = { value, fetchedAt: now };
  return value;
}

async function sendViaClickSend(
  to: string,
  body: string
): Promise<{ status: "SENT" | "SIMULATED"; source: "db" | "env" | "none" }> {
  const config = await getClickSendConfig();
  if (!config) {
    return { status: "SIMULATED" as const, source: "none" as const };
  }

  const payload = {
    messages: [
      {
        source: "api",
        body,
        to,
        from: config.from || undefined,
      },
    ],
  };

  const auth = Buffer.from(`${config.username}:${config.apiKey}`).toString("base64");
  const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ClickSend error ${res.status}: ${text}`);
  }

  return { status: "SENT" as const, source: config.source };
}

export async function sendSms({
  to,
  body,
  templateId,
  patientId,
  userId,
}: SendSmsOptions) {
  if (!to) throw new Error("Numero destinatario mancante");

  let status: "SENT" | "SIMULATED" | "FAILED" = "SENT";
  let error: string | undefined;
   let source: "db" | "env" | "none" = "none";

  try {
    const result = await sendViaClickSend(to, body);
    source = result.source ?? "none";
    status = result.status;
    if (status === "SIMULATED") {
      const reason =
        source === "none"
          ? "ClickSend non configurato"
          : "Configurazione ClickSend non completa";
      console.log(`[sms] invio simulato (${reason})`, { to, body });
    }
  } catch (err: any) {
    status = "FAILED";
    error = err?.message ?? String(err);
  }

  await prisma.smsLog.create({
    data: {
      to,
      body,
      status,
      error,
      templateId: templateId ?? undefined,
      patientId: patientId ?? undefined,
      userId: userId ?? undefined,
      provider: source,
    },
  });

  if (status === "FAILED") {
    throw new Error(error || "Invio SMS fallito");
  }

  return { status };
}
