import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_REMINDER_PLACEHOLDER_KEYS,
  EMAIL_PLACEHOLDER_KEYS,
  MESSAGE_PLACEHOLDER_KEYS,
  RECALL_PLACEHOLDER_KEYS,
  RECURRING_PLACEHOLDER_KEYS,
  appointmentReminderPlaceholders,
  insertPlaceholderToken,
  messagePlaceholders,
  placeholderCatalog,
  recallPlaceholders,
  recurringPlaceholders,
} from "@/lib/placeholder-data";

describe("placeholder catalog", () => {
  it("describes every token each template editor can insert", () => {
    expect(placeholderCatalog.map((item) => item.key)).toEqual([...EMAIL_PLACEHOLDER_KEYS]);
    expect(messagePlaceholders.map((item) => item.key)).toEqual([...MESSAGE_PLACEHOLDER_KEYS]);
    expect(recallPlaceholders.map((item) => item.key)).toEqual([...RECALL_PLACEHOLDER_KEYS]);
    expect(appointmentReminderPlaceholders.map((item) => item.key)).toEqual([
      ...APPOINTMENT_REMINDER_PLACEHOLDER_KEYS,
    ]);
    expect(recurringPlaceholders("HOLIDAY").map((item) => item.key)).toEqual([
      ...RECURRING_PLACEHOLDER_KEYS.HOLIDAY,
    ]);
    expect(recurringPlaceholders("CLOSURE").map((item) => item.key)).toEqual([
      ...RECURRING_PLACEHOLDER_KEYS.CLOSURE,
    ]);
    expect(recurringPlaceholders("BIRTHDAY").map((item) => item.key)).toEqual([
      ...RECURRING_PLACEHOLDER_KEYS.BIRTHDAY,
    ]);
  });

  it("inserts a token at the caret and replaces a selection", () => {
    expect(insertPlaceholderToken("Ciao ", 5, 5, "firstName")).toEqual({
      value: "Ciao {{firstName}}",
      cursor: 18,
    });
    expect(insertPlaceholderToken("Ciao nome", 5, 9, "firstName").value).toBe("Ciao {{firstName}}");
  });
});
