import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendEmailWithHtml: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/kapso-whatsapp", () => ({
  sendKapsoWhatsAppText: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail, sendEmailWithHtml } from "@/lib/email";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";
import { sendSms } from "@/lib/sms";
import {
  deliverNotificationPlan,
  formatNotificationChannel,
  getNotificationChannelLabels,
  notificationPlanHasConfiguredChannel,
} from "@/lib/recalls/delivery";
import { NotificationChannel } from "@prisma/client";

describe("recalls delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists individual channel labels for scheduled recall display", () => {
    expect(getNotificationChannelLabels(NotificationChannel.WHATSAPP)).toEqual([
      { key: "whatsapp", label: "WhatsApp" },
    ]);
    expect(getNotificationChannelLabels(NotificationChannel.BOTH)).toEqual([
      { key: "email", label: "Email" },
      { key: "sms", label: "SMS" },
    ]);
    expect(formatNotificationChannel(NotificationChannel.BOTH)).toBe("Email + SMS");
  });

  it("sends WhatsApp recalls through Kapso when configured", async () => {
    const result = await deliverNotificationPlan({
      patient: { id: "patient-1", email: null, phone: "+393331234567" },
      plan: {
        wantsEmail: false,
        wantsSms: false,
        wantsWhatsApp: true,
        subject: "Promemoria",
        body: "Ciao Mario, è tempo di prenotare l'igiene.",
      },
    });

    expect(sendKapsoWhatsAppText).toHaveBeenCalledWith({
      to: "+393331234567",
      body: "Ciao Mario, è tempo di prenotare l'igiene.",
    });
    expect(result).toEqual({ delivered: true, attempted: true });
  });

  it("marks WhatsApp delivery as skipped when the patient has no phone", async () => {
    const result = await deliverNotificationPlan({
      patient: { id: "patient-1", email: "mario@example.com", phone: null },
      plan: {
        wantsEmail: false,
        wantsSms: false,
        wantsWhatsApp: true,
        subject: "Promemoria",
        body: "Messaggio",
      },
    });

    expect(sendKapsoWhatsAppText).not.toHaveBeenCalled();
    expect(result).toEqual({ delivered: false, attempted: true });
  });

  it("still supports plain email and SMS channels", async () => {
    await deliverNotificationPlan({
      patient: { id: "patient-1", email: "mario@example.com", phone: "+393331234567" },
      plan: {
        wantsEmail: true,
        wantsSms: true,
        wantsWhatsApp: false,
        subject: "Promemoria",
        body: "Messaggio",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmailWithHtml).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendKapsoWhatsAppText).not.toHaveBeenCalled();
  });

  it("sends styled HTML emails when a template body is materialized", async () => {
    await deliverNotificationPlan({
      patient: { id: "patient-1", email: "mario@example.com", phone: null },
      plan: {
        wantsEmail: true,
        wantsSms: false,
        wantsWhatsApp: false,
        subject: "Promemoria appuntamento",
        body: "Ciao Mario Rossi",
        html: "<div>styled email</div>",
      },
    });

    expect(sendEmailWithHtml).toHaveBeenCalledWith(
      "mario@example.com",
      "Promemoria appuntamento",
      "Ciao Mario Rossi",
      "<div>styled email</div>",
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports whether a plan has any configured delivery channel", () => {
    expect(
      notificationPlanHasConfiguredChannel({
        wantsEmail: false,
        wantsSms: false,
        wantsWhatsApp: false,
        subject: "Promemoria",
        body: "Messaggio",
      }),
    ).toBe(false);

    expect(
      notificationPlanHasConfiguredChannel({
        wantsEmail: false,
        wantsSms: false,
        wantsWhatsApp: true,
        subject: "Promemoria",
        body: "Messaggio",
      }),
    ).toBe(true);
  });
});
