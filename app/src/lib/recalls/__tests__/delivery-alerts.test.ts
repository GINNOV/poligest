import { describe, expect, it } from "vitest";
import {
  buildRecallDeliveryFailureAlert,
  describeMissingRecallContact,
  formatFailedDeliverySummary,
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
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: null,
        email: "mario@example.com",
      },
      rule: { name: "Igiene", channel: NotificationChannel.WHATSAPP },
    });

    expect(alert).toEqual({
      id: "recall-1",
      patientId: "patient-1",
      patientName: "Rossi Mario",
      ruleName: "Igiene",
      channelLabel: "WhatsApp",
      dueAt: new Date("2026-07-06T08:00:00.000Z"),
      lastContactAt: new Date("2026-07-06T09:00:00.000Z"),
      contactGap: "Manca il numero di telefono.",
    });
    expect(formatRecallDeliveryFailureTitle(alert)).toBe(
      "Invio automatico non riuscito per Rossi Mario",
    );
    expect(formatRecallDeliveryFailureDetail(alert)).toContain("Igiene · WhatsApp");
  });

  it("keeps separate alert identities so multiple failures can be listed", () => {
    const alerts = [
      buildRecallDeliveryFailureAlert({
        id: "recall-1",
        dueAt: new Date("2026-07-06T08:00:00.000Z"),
        lastContactAt: null,
        patient: {
          id: "patient-1",
          firstName: "Mario",
          lastName: "Rossi",
          phone: "+39333111222",
          email: null,
        },
        rule: { name: "Igiene", channel: NotificationChannel.EMAIL },
      }),
      buildRecallDeliveryFailureAlert({
        id: "recall-2",
        dueAt: new Date("2026-07-07T08:00:00.000Z"),
        lastContactAt: null,
        patient: {
          id: "patient-2",
          firstName: "Anna",
          lastName: "Bianchi",
          phone: null,
          email: "anna@example.com",
        },
        rule: { name: "Controllo", channel: NotificationChannel.SMS },
      }),
    ];

    expect(alerts.map((alert) => alert.id)).toEqual(["recall-1", "recall-2"]);
    expect(alerts.map((alert) => alert.contactGap)).toEqual([
      "Manca l'indirizzo email.",
      "Manca il numero di telefono.",
    ]);
    expect(alerts.map((alert) => formatRecallDeliveryFailureTitle(alert))).toEqual([
      "Invio automatico non riuscito per Rossi Mario",
      "Invio automatico non riuscito per Bianchi Anna",
    ]);
  });

  it("names both missing contacts when the rule uses email and SMS", () => {
    expect(
      describeMissingRecallContact({
        channel: NotificationChannel.BOTH,
        phone: " ",
        email: "",
      }),
    ).toBe("Mancano il telefono e l'email.");
    expect(
      describeMissingRecallContact({
        channel: NotificationChannel.WHATSAPP,
        phone: "+39333111222",
        email: null,
      }),
    ).toBeNull();
  });

  it("summarizes the failure count in one line", () => {
    expect(formatFailedDeliverySummary(1)).toBe("1 invio non riuscito");
    expect(formatFailedDeliverySummary(12)).toBe("12 invii non riusciti");
  });
});
