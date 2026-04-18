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
      whatsappTouches: 0,
      bothChannelRecords: 1,
    });
  });

  test("getCompletedPracticeWeekPeriod returns previous monday-sunday window in Europe/Rome", async () => {
    const { getCompletedPracticeWeekPeriod } = await import("@/lib/practice-weekly-report");

    // Wednesday, April 8, 2026.
    // Since it is NOT yet Saturday, it should return the PREVIOUS full week (Mar 30 - Apr 5).
    const period = getCompletedPracticeWeekPeriod(new Date("2026-04-08T12:00:00.000Z"));

    expect(period.start.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-04-05T22:00:00.000Z");
    expect(period.dedupeKey).toBe("practice-weekly-report:2026-03-30");
    expect(period.label).toBe("30 mar 2026 - 5 apr 2026");
  });

  test("getCompletedPracticeWeekPeriod handles daylight saving transitions", async () => {
    const { getCompletedPracticeWeekPeriod } = await import("@/lib/practice-weekly-report");

    // Tuesday, March 31, 2026.
    // It should return the previous week: Mar 23 - Mar 29.
    const period = getCompletedPracticeWeekPeriod(new Date("2026-03-31T12:00:00.000Z"));

    expect(period.start.toISOString()).toBe("2026-03-22T23:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-03-29T22:00:00.000Z"); // Transition happened!
    expect(period.dedupeKey).toBe("practice-weekly-report:2026-03-23");
    expect(period.label).toBe("23 mar 2026 - 29 mar 2026");
  });

  test("getCompletedPracticeWeekPeriod returns current week if run on Saturday", async () => {
    const { getCompletedPracticeWeekPeriod } = await import("@/lib/practice-weekly-report");

    // Saturday, April 18, 2026
    const period = getCompletedPracticeWeekPeriod(new Date("2026-04-18T14:00:00.000Z"));

    // Should be this week: April 13 (Mon) - April 19 (Sun)
    expect(period.startKey).toBe("2026-04-13");
    expect(period.endKey).toBe("2026-04-19");
    expect(period.label).toBe("13 apr 2026 - 19 apr 2026");
  });

  test("createPracticeWeeklyReportPeriod rebuilds labels from stored period boundaries", async () => {
    const { createPracticeWeeklyReportPeriod } = await import("@/lib/practice-weekly-report");

    const period = createPracticeWeeklyReportPeriod(
      new Date("2026-03-29T22:00:00.000Z"),
      new Date("2026-04-05T22:00:00.000Z"),
    );

    expect(period.dedupeKey).toBe("practice-weekly-report:2026-03-30");
    expect(period.startKey).toBe("2026-03-30");
    expect(period.endKey).toBe("2026-04-05");
    expect(period.label).toBe("30 mar 2026 - 5 apr 2026");
  });
});
