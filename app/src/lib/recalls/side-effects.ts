import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { sendSms } from "@/lib/sms";

async function sendEmail(to: string, subject: string, body: string) {
  console.log("[manual] email", { to, subject, body });
}

export function revalidateRichiami() {
  revalidatePath("/richiami");
  revalidatePath("/richiami/programmati");
  revalidatePath("/richiami/regole");
  revalidatePath("/richiami/manuale");
  revalidatePath("/richiami/ricorrenti");
}

export async function deliverManualNotification(params: {
  user: { id: string; role: Role };
  patient: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null };
  channel: "EMAIL" | "SMS" | "BOTH";
  message: string;
  emailSubject: string;
  notificationType: "appointment" | "event";
}) {
  const wantsEmail = params.channel === "EMAIL" || params.channel === "BOTH";
  const wantsSms = params.channel === "SMS" || params.channel === "BOTH";

  if (wantsEmail && !params.patient.email) {
    throw new Error("Email del paziente mancante.");
  }
  if (wantsSms && !params.patient.phone) {
    throw new Error("Numero di telefono del paziente mancante.");
  }

  if (wantsEmail && params.patient.email) {
    await sendEmail(params.patient.email, params.emailSubject || "Promemoria", params.message);
  }
  if (wantsSms && params.patient.phone) {
    await sendSms({
      to: params.patient.phone,
      body: params.message,
      patientId: params.patient.id,
      userId: params.user.id,
    });
  }

  await logAudit(params.user, {
    action: "notification.manual_sent",
    entity: "Patient",
    entityId: params.patient.id,
    metadata: { channel: params.channel, notificationType: params.notificationType },
  });
}
