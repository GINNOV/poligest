import { prisma } from "@/lib/prisma";

type SendSmsOptions = {
  to: string;
  body: string;
  templateId?: string | null;
  patientId?: string | null;
  userId?: string | null;
};

const clickSendUser = process.env.CLICKSEND_USERNAME;
const clickSendKey = process.env.CLICKSEND_API_KEY;
const clickSendFrom = process.env.CLICKSEND_FROM;

async function sendViaClickSend(to: string, body: string) {
  if (!clickSendUser || !clickSendKey) {
    return { status: "SIMULATED" as const };
  }

  const payload = {
    messages: [
      {
        source: "api",
        body,
        to,
        from: clickSendFrom || undefined,
      },
    ],
  };

  const auth = Buffer.from(`${clickSendUser}:${clickSendKey}`).toString("base64");
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

  return { status: "SENT" as const };
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

  try {
    const result = await sendViaClickSend(to, body);
    status = result.status;
    if (status === "SIMULATED") {
      console.log("[sms] invio simulato (ClickSend non configurato)", { to, body });
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
    },
  });

  if (status === "FAILED") {
    throw new Error(error || "Invio SMS fallito");
  }

  return { status };
}
