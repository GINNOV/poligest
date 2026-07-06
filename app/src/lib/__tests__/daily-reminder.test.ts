import { describe, expect, test } from "vitest";
import { AppointmentStatus, Gender, Role } from "@prisma/client";
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

  test("resolveDailyReminderBccEmail supports multiple configured BCC recipients", () => {
    expect(
      normalizeDailyReminderBccEmail(
        " Studio.Agovino.Angrisano@gmail.com, admin@example.com\nADMIN@example.com ",
      ),
    ).toBe(`${DEFAULT_DAILY_REMINDER_BCC_EMAIL}, admin@example.com`);

    expect(
      resolveDailyReminderBccEmail(
        `${DEFAULT_DAILY_REMINDER_BCC_EMAIL}, admin@example.com`,
        "medico@example.com",
      ),
    ).toEqual([DEFAULT_DAILY_REMINDER_BCC_EMAIL, "admin@example.com"]);
  });

  test("resolveDailyReminderBccEmail removes the direct recipient from multiple BCC recipients", () => {
    expect(
      resolveDailyReminderBccEmail(
        `${DEFAULT_DAILY_REMINDER_BCC_EMAIL}, medico@example.com`,
        "medico@example.com",
      ),
    ).toBe(DEFAULT_DAILY_REMINDER_BCC_EMAIL);
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
      hashedPassword: null,
      role: Role.ADMIN,
      locale: "it",
      isActive: true,
      lastLoginAt: null,
      avatarUrl: null,
      personalPin: null,
      gender: Gender.NOT_SPECIFIED,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      doctor: {
        id: "doctor-1",
        userId: "user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        phone: null,
        notes: null,
        fullName: "Dr. Mario Rossi",
        specialty: "Odontoiatria",
        color: null,
      },
    } as const;

    const appointments = [
      {
        id: "appt-1",
        title: "Controllo",
        startsAt: new Date("2026-06-30T07:00:00.000Z"),
        endsAt: new Date("2026-06-30T07:30:00.000Z"),
        status: AppointmentStatus.CONFIRMED,
        serviceType: "Controllo",
        notes: "Controllo",
        patientId: "patient-1",
        doctorId: "doctor-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        patient: {
          id: "patient-1",
          firstName: "Luigi",
          lastName: "Bianchi",
          email: null,
          phone: null,
          gender: Gender.NOT_SPECIFIED,
          birthDate: null,
          notes: null,
          photoUrl: null,
          hasPaperConsentForRequired: false,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
      {
        id: "appt-2",
        title: "Prima visita",
        startsAt: new Date("2026-06-30T08:00:00.000Z"),
        endsAt: new Date("2026-06-30T08:45:00.000Z"),
        status: AppointmentStatus.TO_CONFIRM,
        serviceType: "Prima visita",
        notes: null,
        patientId: "patient-2",
        doctorId: "doctor-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        patient: {
          id: "patient-2",
          firstName: "Anna",
          lastName: "Verdi",
          email: null,
          phone: null,
          gender: Gender.NOT_SPECIFIED,
          birthDate: null,
          notes: null,
          photoUrl: null,
          hasPaperConsentForRequired: false,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    ];

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
    expect(html).toContain("href=\"https://sorrisosplendente.com/pazienti/patient-1/scheda\"");
    expect(html).toContain("Confermati");
    expect(html).toContain("Prenotato da");
    expect(html).toContain("Segretaria Rossi");
    expect(text).toContain("Dr. Mario Rossi");
    expect(text).toContain("Scheda paziente: https://sorrisosplendente.com/pazienti/patient-2/scheda");
    expect(text).toContain("Prenotato da: Admin Studio");
    expect(text).toContain("Da confermare: 1");
    expect(html).toContain("Invio automatico di SORRISO");
  });
});
