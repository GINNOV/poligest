import { describe, expect, it } from "vitest";
import {
  buildRecallDeliveryFailureAlert,
  formatRecallDeliveryFailureDetail,
  formatRecallDeliveryFailureTitle,
} from "@/lib/recalls/delivery-alerts";
import { NotificationChannel } from "@prisma/client";

describe("recall delivery failure alerts", () => {
  it("builds a persistent alert for a skipped recall delivery", () => {
    const alert = buildRecallDeliveryFailureAlert({
      id: "recall-1",
      dueAt: new Date("2026-07-06T08:00:00.000Z"),
      lastContactAt: new Date("2026-07-06T09:00:00.000Z"),
      patient: { firstName: "Mario", lastName: "Rossi" },
      rule: { name: "Igiene", channel: NotificationChannel.WHATSAPP },
    });

    expect(alert).toEqual({
      id: "recall-1",
      patientName: "Rossi Mario",
      ruleName: "Igiene",
      channelLabel: "WhatsApp",
      dueAt: new Date("2026-07-06T08:00:00.000Z"),
      lastContactAt: new Date("2026-07-06T09:00:00.000Z"),
    });
    expect(formatRecallDeliveryFailureTitle(alert)).toBe(
      "Invio automatico non riuscito per Rossi Mario",
    );
    expect(formatRecallDeliveryFailureDetail(alert)).toContain("Igiene · WhatsApp");
  });

  it("keeps separate alert identities so multiple failures can stack", () => {
    const alerts = [
      buildRecallDeliveryFailureAlert({
        id: "recall-1",
        dueAt: new Date("2026-07-06T08:00:00.000Z"),
        lastContactAt: null,
        patient: { firstName: "Mario", lastName: "Rossi" },
        rule: { name: "Igiene", channel: NotificationChannel.EMAIL },
      }),
      buildRecallDeliveryFailureAlert({
        id: "recall-2",
        dueAt: new Date("2026-07-07T08:00:00.000Z"),
        lastContactAt: null,
        patient: { firstName: "Anna", lastName: "Bianchi" },
        rule: { name: "Controllo", channel: NotificationChannel.SMS },
      }),
    ];

    expect(alerts.map((alert) => alert.id)).toEqual(["recall-1", "recall-2"]);
    expect(alerts.map((alert) => formatRecallDeliveryFailureTitle(alert))).toEqual([
      "Invio automatico non riuscito per Rossi Mario",
      "Invio automatico non riuscito per Bianchi Anna",
    ]);
  });
});
