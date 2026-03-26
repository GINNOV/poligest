import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { deliverManualNotification } from "@/lib/recalls/side-effects";

describe("recalls side-effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects SMS delivery without a phone number", async () => {
    await expect(
      deliverManualNotification({
        user: { id: "user-1", role: "ADMIN" as const },
        patient: { id: "patient-1", firstName: "Mario", lastName: "Rossi", email: null, phone: null },
        channel: "SMS",
        message: "Promemoria",
        emailSubject: "Avviso",
        notificationType: "appointment",
      }),
    ).rejects.toThrow("Numero di telefono del paziente mancante.");
  });

  it("sends SMS and logs the notification when a phone number is present", async () => {
    await deliverManualNotification({
      user: { id: "user-1", role: "ADMIN" as const },
      patient: { id: "patient-1", firstName: "Mario", lastName: "Rossi", email: null, phone: "+39123456789" },
      channel: "SMS",
      message: "Promemoria",
      emailSubject: "Avviso",
      notificationType: "appointment",
    });

    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledTimes(1);
  });
});
