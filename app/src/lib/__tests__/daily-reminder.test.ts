import { describe, expect, test } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import {
  buildDailyReminderSubject,
  DEFAULT_DAILY_REMINDER_BCC_EMAIL,
  DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES,
  generateDailyReminderContent,
  getMinutesOfDayInTimeZone,
  normalizeDailyReminderBccEmail,
  resolveDailyReminderBccEmail,
  shouldSendDailyReminderNow,
} from "@/lib/daily-reminder";

describe("daily reminder helpers", () => {
  test("getMinutesOfDayInTimeZone returns local minutes in Europe/Rome", () => {
    const minutes = getMinutesOfDayInTimeZone(new Date("2026-06-29T18:15:00.000Z"), "Europe/Rome");
    expect(minutes).toBe(20 * 60 + 15);
  });

  test("shouldSendDailyReminderNow waits until configured evening time", () => {
    expect(
      shouldSendDailyReminderNow({
        now: new Date("2026-06-29T17:30:00.000Z"),
        timeZone: "Europe/Rome",
        sendTimeMinutes: DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES,
      }),
    ).toBe(false);

    expect(
      shouldSendDailyReminderNow({
        now: new Date("2026-06-29T18:00:00.000Z"),
        timeZone: "Europe/Rome",
        sendTimeMinutes: DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES,
      }),
    ).toBe(true);
  });

  test("shouldSendDailyReminderNow bypasses schedule when forced", () => {
    expect(
      shouldSendDailyReminderNow({
        now: new Date("2026-06-29T10:00:00.000Z"),
        timeZone: "Europe/Rome",
        sendTimeMinutes: DEFAULT_DAILY_REMINDER_SEND_TIME_MINUTES,
        force: true,
      }),
    ).toBe(true);
  });

  test("resolveDailyReminderBccEmail defaults to studio inbox when unset", () => {
    expect(resolveDailyReminderBccEmail(undefined)).toBe(DEFAULT_DAILY_REMINDER_BCC_EMAIL);
    expect(resolveDailyReminderBccEmail(" Studio.Agovino.Angrisano@gmail.com ")).toBe(
      DEFAULT_DAILY_REMINDER_BCC_EMAIL,
    );
  });

  test("resolveDailyReminderBccEmail can be disabled or deduplicated", () => {
    expect(resolveDailyReminderBccEmail(null)).toBeUndefined();
    expect(normalizeDailyReminderBccEmail("")).toBeNull();
    expect(
      resolveDailyReminderBccEmail(DEFAULT_DAILY_REMINDER_BCC_EMAIL, DEFAULT_DAILY_REMINDER_BCC_EMAIL),
    ).toBeUndefined();
  });

  test("buildDailyReminderSubject matches report-style naming", () => {
    const subject = buildDailyReminderSubject(new Date("2026-06-30T10:00:00.000Z"), "Europe/Rome");
    expect(subject).toMatch(/^Agenda di domani · /);
    expect(subject).toContain("30");
  });

  test("generateDailyReminderContent uses weekly report layout cues", () => {
    const user = {
      id: "user-1",
      email: "medico@example.com",
      name: "Dr. Rossi",
      doctor: {
        id: "doctor-1",
        fullName: "Dr. Mario Rossi",
      },
    } as const;

    const appointments = [
      {
        id: "appt-1",
        startsAt: new Date("2026-06-30T07:00:00.000Z"),
        endsAt: new Date("2026-06-30T07:30:00.000Z"),
        status: AppointmentStatus.CONFIRMED,
        notes: "Controllo",
        patient: {
          firstName: "Luigi",
          lastName: "Bianchi",
        },
      },
      {
        id: "appt-2",
        startsAt: new Date("2026-06-30T08:00:00.000Z"),
        endsAt: new Date("2026-06-30T08:45:00.000Z"),
        status: AppointmentStatus.TO_CONFIRM,
        notes: null,
        patient: {
          firstName: "Anna",
          lastName: "Verdi",
        },
      },
    ] as const;

    const schedulerByAppointmentId = new Map([
      ["appt-1", "Segretaria Rossi"],
      ["appt-2", "Admin Studio"],
    ]);

    const { html, text } = generateDailyReminderContent(
      user,
      appointments,
      new Date("2026-06-30T00:00:00.000Z"),
      "Europe/Rome",
      schedulerByAppointmentId,
    );

    expect(html).toContain("Agenda di domani");
    expect(html).toContain("studio_agovinoangrisano_logo.png");
    expect(html).toContain("Dettaglio appuntamenti");
    expect(html).toContain("Bianchi Luigi");
    expect(html).toContain("Confermati");
    expect(html).toContain("Prenotato da");
    expect(html).toContain("Segretaria Rossi");
    expect(text).toContain("Dr. Mario Rossi");
    expect(text).toContain("Prenotato da: Admin Studio");
    expect(text).toContain("Da confermare: 1");
    expect(html).toContain("Invio automatico di SORRISO");
  });
});