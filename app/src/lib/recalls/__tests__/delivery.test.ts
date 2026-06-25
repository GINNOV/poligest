import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/kapso-whatsapp", () => ({
  sendKapsoWhatsAppText: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from "@/lib/email";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";
import { sendSms } from "@/lib/sms";
import { deliverNotificationPlan } from "@/lib/recalls/delivery";

describe("recalls delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("still supports email and SMS channels", async () => {
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
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendKapsoWhatsAppText).not.toHaveBeenCalled();
  });
});