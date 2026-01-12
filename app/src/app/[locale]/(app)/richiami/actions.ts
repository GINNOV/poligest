"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { NotificationChannel, Prisma, RecallStatus, Role } from "@prisma/client";

// Stubbed email sender; replace with real provider integrations.
async function sendEmail(to: string, subject: string, body: string) {
  console.log("[manual] email", { to, subject, body });
}

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function revalidateRichiami() {
  revalidatePath("/richiami");
  revalidatePath("/richiami/programmati");
  revalidatePath("/richiami/regole");
  revalidatePath("/richiami/manuale");
  revalidatePath("/richiami/ricorrenti");
}

export async function createRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const intervalDays = Number(formData.get("intervalDays"));
  const message = (formData.get("message") as string)?.trim() || null;
  const emailSubject = (formData.get("emailSubject") as string)?.trim() || null;
  const channelRaw = (formData.get("channel") as string) || NotificationChannel.EMAIL;
  const channel = Object.values(NotificationChannel).includes(channelRaw as NotificationChannel)
    ? (channelRaw as NotificationChannel)
    : NotificationChannel.EMAIL;
  if (!name || !serviceType || Number.isNaN(intervalDays) || intervalDays <= 0) {
    throw new Error("Dati regola non validi");
  }

  const data: Record<string, unknown> = { name, serviceType, intervalDays, message, emailSubject, channel };
  try {
    await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
  } catch (err: unknown) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("Unknown argument `emailSubject`")) {
        delete data.emailSubject;
      }
      if (msg.includes("Unknown argument `channel`")) {
        delete data.channel;
      }
      await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
      revalidateRichiami();
      return;
    }
    throw err;
  }
  revalidateRichiami();
}

export async function updateAppointmentReminderRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const ruleId = (formData.get("ruleId") as string) || null;
  const daysBefore = Number(formData.get("daysBefore"));
  const templateName = (formData.get("templateName") as string)?.trim() || null;
  const emailSubject = (formData.get("emailSubject") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim() || null;
  const enabled = formData.get("enabled") === "on";
  const channelRaw = (formData.get("channel") as string) || NotificationChannel.EMAIL;
  const channel = Object.values(NotificationChannel).includes(channelRaw as NotificationChannel)
    ? (channelRaw as NotificationChannel)
    : NotificationChannel.EMAIL;

  if (Number.isNaN(daysBefore) || daysBefore <= 0) {
    throw new Error("Intervallo non valido");
  }

  const data: Record<string, unknown> = {
    daysBefore,
    channel,
    emailSubject,
    message,
    enabled,
    templateName,
  };

  try {
    if (ruleId) {
      await prisma.appointmentReminderRule.update({
        where: { id: ruleId },
        data: data as Prisma.AppointmentReminderRuleUpdateInput,
      });
    } else {
      const existing = await prisma.appointmentReminderRule.findFirst();
      if (existing) {
        await prisma.appointmentReminderRule.update({
          where: { id: existing.id },
          data: data as Prisma.AppointmentReminderRuleUpdateInput,
        });
      } else {
        await prisma.appointmentReminderRule.create({
          data: data as Prisma.AppointmentReminderRuleCreateInput,
        });
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unknown argument `templateName`")) {
      delete data.templateName;
      if (ruleId) {
        await prisma.appointmentReminderRule.update({
          where: { id: ruleId },
          data: data as Prisma.AppointmentReminderRuleUpdateInput,
        });
      } else {
        const existing = await prisma.appointmentReminderRule.findFirst();
        if (existing) {
          await prisma.appointmentReminderRule.update({
            where: { id: existing.id },
            data: data as Prisma.AppointmentReminderRuleUpdateInput,
          });
        } else {
          await prisma.appointmentReminderRule.create({
            data: data as Prisma.AppointmentReminderRuleCreateInput,
          });
        }
      }
    } else {
      throw err;
    }
  }

  revalidateRichiami();
}

export async function scheduleRecall(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = formData.get("patientId") as string;
  const ruleId = formData.get("ruleId") as string;
  const dueAt = formData.get("dueAt") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!patientId || !ruleId || !dueAt) throw new Error("Dati mancanti");

  await prisma.recall.create({
    data: {
      patientId,
      ruleId,
      dueAt: new Date(dueAt),
      status: RecallStatus.PENDING,
      notes,
    },
  });
  revalidateRichiami();
}

export async function deleteRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN]);
  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) throw new Error("Regola non valida");

  await prisma.$transaction([
    prisma.recall.deleteMany({ where: { ruleId } }),
    prisma.recallRule.delete({ where: { id: ruleId } }),
  ]);
  revalidateRichiami();
}

export async function updateRecurringConfig(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const kind = (formData.get("kind") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const enabled = formData.get("enabled") === "on";
  const daysBeforeRaw = formData.get("daysBefore");
  const daysBefore = daysBeforeRaw ? Number(daysBeforeRaw) : null;

  if (!kind || !subject || !body) {
    throw new Error("Configurazione non valida");
  }

  await prisma.recurringMessageConfig.upsert({
    where: { kind: kind as "HOLIDAY" | "CLOSURE" | "BIRTHDAY" },
    create: {
      kind: kind as "HOLIDAY" | "CLOSURE" | "BIRTHDAY",
      enabled,
      subject,
      body,
      daysBefore: daysBefore ?? undefined,
    },
    update: {
      enabled,
      subject,
      body,
      daysBefore: daysBefore ?? undefined,
    },
  });

  revalidateRichiami();
}

export async function updateRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const ruleId = (formData.get("ruleId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const intervalDays = Number(formData.get("intervalDays"));
  const message = (formData.get("message") as string)?.trim() || null;
  const emailSubject = (formData.get("emailSubject") as string)?.trim() || null;
  const channelRaw = (formData.get("channel") as string) || NotificationChannel.EMAIL;
  const channel = Object.values(NotificationChannel).includes(channelRaw as NotificationChannel)
    ? (channelRaw as NotificationChannel)
    : NotificationChannel.EMAIL;

  if (!ruleId || !name || !serviceType || Number.isNaN(intervalDays) || intervalDays <= 0) {
    throw new Error("Dati regola non validi");
  }

  await prisma.recallRule.update({
    where: { id: ruleId },
    data: {
      name,
      serviceType,
      intervalDays,
      message,
      emailSubject,
      channel,
    },
  });

  revalidateRichiami();
}

export async function deleteScheduledRecall(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const recallId = formData.get("recallId") as string;
  if (!recallId) throw new Error("Richiamo non valido");

  await prisma.recall.delete({ where: { id: recallId } });
  revalidateRichiami();
}

export async function sendManualNotification(formData: FormData) {
  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
    const notificationType = (formData.get("notificationType") as string) || "appointment";
    const channel = (formData.get("channel") as string) || "EMAIL";
    const messageInput = (formData.get("message") as string)?.trim() || "";
    const emailSubjectInput = (formData.get("emailSubject") as string)?.trim() || "";
    const returnTo = (formData.get("returnTo") as string) || "/richiami/manuale";

    let patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    } | null = null;
    let message = messageInput;
    let emailSubject = emailSubjectInput;
    let eventLabel = "";
    let eventDate: Date | null = null;

    if (notificationType === "appointment") {
      const appointmentId = (formData.get("appointmentId") as string) || "";
      if (!appointmentId) throw new Error("Seleziona un appuntamento.");

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      if (!appointment) throw new Error("Appuntamento non trovato.");
      patient = appointment.patient;
      eventLabel = appointment.title || "Appuntamento";
      eventDate = appointment.startsAt;

      if (!emailSubject) {
        emailSubject = "Promemoria appuntamento";
      }
    } else {
      const patientId = (formData.get("patientId") as string) || "";
      const eventTitle = (formData.get("eventTitle") as string)?.trim() || "";
      const eventAtRaw = (formData.get("eventAt") as string)?.trim() || "";
      if (!patientId) throw new Error("Seleziona un paziente.");

      patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
      if (!patient) throw new Error("Paziente non trovato.");

      eventLabel = eventTitle || "Evento";
      const parsedEventDate = eventAtRaw ? new Date(eventAtRaw) : null;
      eventDate =
        parsedEventDate && !Number.isNaN(parsedEventDate.getTime()) ? parsedEventDate : null;

      if (!emailSubject) {
        emailSubject = eventTitle ? `Promemoria ${eventTitle}` : "Promemoria evento";
      }

      if (!message && (!eventTitle || !eventDate)) {
        throw new Error("Inserisci un messaggio o i dettagli dell'evento.");
      }
    }

    if (!patient) throw new Error("Destinatario non valido.");

    if (!message) {
      if (!eventDate) throw new Error("Inserisci un messaggio.");
      const dateLabel = new Intl.DateTimeFormat("it-IT", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(eventDate);
      const timeLabel = new Intl.DateTimeFormat("it-IT", {
        timeStyle: "short",
      }).format(eventDate);
      const name = `${patient.lastName ?? ""} ${patient.firstName ?? ""}`.trim() || "paziente";
      message = `Gentile ${name}, promemoria: ${eventLabel} il ${dateLabel} alle ${timeLabel}.`;
    }

    const wantsEmail = channel === "EMAIL" || channel === "BOTH";
    const wantsSms = channel === "SMS" || channel === "BOTH";

    if (wantsEmail && !patient.email) {
      throw new Error("Email del paziente mancante.");
    }
    if (wantsSms && !patient.phone) {
      throw new Error("Numero di telefono del paziente mancante.");
    }

    if (wantsEmail && patient.email) {
      await sendEmail(patient.email, emailSubject || "Promemoria", message);
    }
    if (wantsSms && patient.phone) {
      await sendSms({
        to: patient.phone,
        body: message,
        patientId: patient.id,
        userId: user.id,
      });
    }

    await logAudit(user, {
      action: "notification.manual_sent",
      entity: "Patient",
      entityId: patient.id,
      metadata: { channel, notificationType },
    });

    revalidateRichiami();
    redirect(`${returnTo}?manualSuccess=${encodeURIComponent("Notifica inviata con successo.")}`);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Impossibile inviare la notifica.";
    const returnTo = (formData.get("returnTo") as string) || "/richiami/manuale";
    redirect(`${returnTo}?manualError=${encodeURIComponent(message)}`);
  }
}
