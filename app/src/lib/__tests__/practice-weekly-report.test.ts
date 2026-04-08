import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmailWithHtml: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

describe("practice weekly report helpers", () => {
  test("parseRecipientEmails normalizes, deduplicates, and filters invalid values", async () => {
    const { parseRecipientEmails } = await import("@/lib/practice-weekly-report");

    expect(
      parseRecipientEmails("TEAM@example.com, invalid\nowner@example.com ; team@example.com"),
    ).toEqual(["team@example.com", "owner@example.com"]);
  });

  test("summarizeChannels counts email and sms touches", async () => {
    const { summarizeChannels } = await import("@/lib/practice-weekly-report");

    expect(summarizeChannels(["EMAIL", "SMS", "BOTH", null])).toEqual({
      records: 4,
      emailTouches: 3,
      smsTouches: 2,
      bothChannelRecords: 1,
    });
  });

  test("getCompletedPracticeWeekPeriod returns previous monday-sunday window in Europe/Rome", async () => {
    const { getCompletedPracticeWeekPeriod } = await import("@/lib/practice-weekly-report");

    const period = getCompletedPracticeWeekPeriod(new Date("2026-04-08T12:00:00.000Z"));

    expect(period.start.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-04-05T22:00:00.000Z");
    expect(period.dedupeKey).toBe("practice-weekly-report:2026-03-30");
    expect(period.label).toBe("30 mar 2026 - 5 apr 2026");
  });

  test("getCompletedPracticeWeekPeriod handles daylight saving transitions", async () => {
    const { getCompletedPracticeWeekPeriod } = await import("@/lib/practice-weekly-report");

    const period = getCompletedPracticeWeekPeriod(new Date("2026-03-31T12:00:00.000Z"));

    expect(period.start.toISOString()).toBe("2026-03-22T23:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(period.dedupeKey).toBe("practice-weekly-report:2026-03-23");
    expect(period.label).toBe("23 mar 2026 - 29 mar 2026");
  });
});
