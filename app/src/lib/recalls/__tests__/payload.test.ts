import { NotificationChannel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  parseAppointmentReminderRulePayload,
  parseCreateRecallRulePayload,
  parseRecurringMessagePayload,
  parseScheduledRecallPayload,
  parseUpdateRecallRulePayload,
} from "@/lib/recalls/payload";

function makeFormData(entries: Array<[string, string]>) {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.append(key, value);
  }
  return formData;
}

describe("recalls payload", () => {
  it("parses recall rules with trimming and fallback channel handling", () => {
    const payload = parseCreateRecallRulePayload(
      makeFormData([
        ["name", "  Igiene  "],
        ["serviceType", "  Pulizia  "],
        ["intervalDays", "180"],
        ["channel", "NOT_A_CHANNEL"],
      ]),
    );

    expect(payload).toMatchObject({
      name: "Igiene",
      serviceType: "Pulizia",
      intervalDays: 180,
      channel: NotificationChannel.WHATSAPP,
    });
  });

  it("parses appointment reminder rules with sensible defaults", () => {
    const payload = parseAppointmentReminderRulePayload(
      makeFormData([
        ["daysBefore", "7"],
        ["timingType", "SAME_DAY_TIME"],
        ["timeOfDay", "09:30"],
        ["enabled", "on"],
      ]),
    );

    expect(payload.timeOfDayMinutes).toBe(570);
    expect(payload.enabled).toBe(true);
    expect(payload.channel).toBe(NotificationChannel.WHATSAPP);
  });

  it("parses scheduled recall payloads", () => {
    const scheduled = parseScheduledRecallPayload(
      makeFormData([
        ["patientId", "patient-1"],
        ["ruleId", "rule-1"],
        ["dueAt", "2026-03-25T10:00"],
      ]),
    );

    expect(scheduled.patientId).toBe("patient-1");
    expect(scheduled.dueAt.toISOString()).toBe("2026-03-25T09:00:00.000Z");
  });

  it("parses recurring message payloads and rejects invalid kinds", () => {
    expect(
      parseRecurringMessagePayload(
        makeFormData([
          ["kind", "HOLIDAY"],
          ["subject", "Ferie"],
          ["body", "Studio chiuso"],
          ["enabled", "on"],
          ["daysBefore", "3"],
        ]),
      ).kind,
    ).toBe("HOLIDAY");

    expect(() =>
      parseRecurringMessagePayload(
        makeFormData([
          ["kind", "INVALID"],
          ["subject", "Ferie"],
          ["body", "Studio chiuso"],
        ]),
      ),
    ).toThrow("Configurazione non valida");
  });

  it("binds update payloads to a specific rule id", () => {
    const payload = parseUpdateRecallRulePayload(
      makeFormData([
        ["ruleId", "rule-1"],
        ["name", "Controllo"],
        ["serviceType", "Visita"],
        ["intervalDays", "90"],
      ]),
    );

    expect(payload.ruleId).toBe("rule-1");
    expect(payload.intervalDays).toBe(90);
  });
});