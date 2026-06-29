import { AppointmentStatus, NotificationChannel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildAppointmentReminderDeliveryPlan,
  buildRecallDeliveryPlan,
  computeAppointmentReminderCreates,
  computeRecurringRecallCreates,
  shouldSkipAppointmentReminder,
} from "@/lib/recalls/send-domain";

describe("recalls send domain", () => {
  it("skips recurring recall creation when a pending recall exists", () => {
    const creates = computeRecurringRecallCreates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      horizon: new Date("2026-12-31T10:00:00.000Z"),
      rule: { id: "rule-1", intervalDays: 30 },
      lastAppointments: [{ patientId: "patient-1", _max: { startsAt: new Date("2026-01-01T10:00:00.000Z") } }],
      lastRecalls: [],
      pendingRecalls: [{ patientId: "patient-1", _max: { dueAt: new Date("2026-03-30T10:00:00.000Z") } }],
    });

    expect(creates).toEqual([]);
  });

  it("uses the last recall date when it is newer than the last visit and clamps overdue results to now", () => {
    const creates = computeRecurringRecallCreates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      horizon: new Date("2026-12-31T10:00:00.000Z"),
      rule: { id: "rule-1", intervalDays: 30 },
      lastAppointments: [{ patientId: "patient-1", _max: { startsAt: new Date("2026-01-01T10:00:00.000Z") } }],
      lastRecalls: [{ patientId: "patient-1", _max: { dueAt: new Date("2026-02-01T10:00:00.000Z") } }],
      pendingRecalls: [],
    });

    expect(creates[0]?.dueAt.toISOString()).toBe("2026-03-25T10:00:00.000Z");
  });

  it("clamps overdue recurring recalls to now and skips due dates beyond the horizon", () => {
    const creates = computeRecurringRecallCreates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      horizon: new Date("2026-03-30T10:00:00.000Z"),
      rule: { id: "rule-1", intervalDays: 30 },
      lastAppointments: [
        { patientId: "patient-1", _max: { startsAt: new Date("2025-01-01T10:00:00.000Z") } },
        { patientId: "patient-2", _max: { startsAt: new Date("2026-03-10T10:00:00.000Z") } },
      ],
      lastRecalls: [],
      pendingRecalls: [],
    });

    expect(creates).toHaveLength(1);
    expect(creates[0]?.patientId).toBe("patient-1");
    expect(creates[0]?.dueAt.toISOString()).toBe("2026-03-25T10:00:00.000Z");
  });

  it("computes same-day reminder due dates and clamps overdue ones", () => {
    const creates = computeAppointmentReminderCreates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      horizon: new Date("2026-04-24T10:00:00.000Z"),
      rule: { id: "rule-1", daysBefore: 2, timingType: "SAME_DAY_TIME", timeOfDayMinutes: 540 },
      appointments: [{ id: "appt-1", patientId: "patient-1", startsAt: new Date("2026-03-25T08:00:00.000Z") }],
    });

    expect(creates[0]?.dueAt.toISOString()).toBe("2026-03-25T10:00:00.000Z");
  });

  it("computes days-before reminder due dates and skips reminders beyond the horizon", () => {
    const creates = computeAppointmentReminderCreates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      horizon: new Date("2026-04-01T10:00:00.000Z"),
      rule: { id: "rule-1", daysBefore: 3, timingType: "DAYS_BEFORE", timeOfDayMinutes: null },
      appointments: [
        { id: "appt-1", patientId: "patient-1", startsAt: new Date("2026-03-28T09:00:00.000Z") },
        { id: "appt-2", patientId: "patient-2", startsAt: new Date("2026-04-10T09:00:00.000Z") },
      ],
    });

    expect(creates).toHaveLength(1);
    expect(creates[0]?.appointmentId).toBe("appt-1");
    expect(creates[0]?.dueAt.toISOString()).toBe("2026-03-25T10:00:00.000Z");
  });

  it("uses the practice timezone when scheduling future appointment reminders", () => {
    const creates = computeAppointmentReminderCreates({
      now: new Date("2026-03-20T10:00:00.000Z"),
      horizon: new Date("2026-04-01T10:00:00.000Z"),
      rule: { id: "rule-1", daysBefore: 2, timingType: "DAYS_BEFORE", timeOfDayMinutes: 540 },
      appointments: [
        { id: "appt-1", patientId: "patient-1", startsAt: new Date("2026-03-28T09:00:00.000Z") },
      ],
    });

    expect(creates[0]?.dueAt.toISOString()).toBe("2026-03-26T08:00:00.000Z");
  });

  it("skips past and completed appointment reminders", () => {
    expect(
      shouldSkipAppointmentReminder(new Date("2026-03-25T10:00:00.000Z"), {
        startsAt: new Date("2026-03-25T09:00:00.000Z"),
        status: AppointmentStatus.COMPLETED,
      }),
    ).toBe(true);
  });

  it("builds recall delivery content and channel plan", () => {
    const plan = buildRecallDeliveryPlan({
      patient: { firstName: "Mario", lastName: "Rossi" },
      rule: {
        serviceType: "Igiene",
        emailSubject: "Promemoria {{patientName}}",
        message: "Servizio {{serviceType}}",
        channel: NotificationChannel.BOTH,
      },
      template: null,
    });

    expect(plan).toMatchObject({
      subject: "Promemoria Rossi Mario",
      body: "Servizio Igiene",
      wantsEmail: true,
      wantsSms: true,
      wantsWhatsApp: false,
    });
  });

  it("defaults recurring recalls to WhatsApp", () => {
    const plan = buildRecallDeliveryPlan({
      patient: { firstName: "Mario", lastName: "Rossi" },
      rule: {
        serviceType: "Ablazione tartaro",
        channel: NotificationChannel.WHATSAPP,
      },
      template: null,
    });

    expect(plan).toMatchObject({
      wantsEmail: false,
      wantsSms: false,
      wantsWhatsApp: true,
      body: "Ciao Mario, è tempo di prenotare Ablazione tartaro. Contattaci per fissare un appuntamento.",
    });
  });

  it("builds appointment reminder delivery content", () => {
    const plan = buildAppointmentReminderDeliveryPlan({
      patient: { firstName: "Mario", lastName: "Rossi" },
      appointment: {
        startsAt: new Date("2026-03-30T09:30:00.000Z"),
        doctor: { fullName: "Dr. Bianchi" },
      },
      rule: {
        emailSubject: "Promemoria",
        message: "Con {{doctorName}} il {{appointmentDate}} alle {{appointmentTime}}",
        channel: "EMAIL",
      },
      template: null,
    });

    expect(plan.wantsEmail).toBe(true);
    expect(plan.wantsSms).toBe(false);
    expect(plan.body).toContain("Dr. Bianchi");
    expect(plan.body).toContain("11:30");
    expect(plan.html).toBeUndefined();
  });

  it("materializes styled HTML when an email template is provided", () => {
    const plan = buildAppointmentReminderDeliveryPlan({
      patient: { firstName: "Mario", lastName: "Rossi" },
      appointment: {
        startsAt: new Date("2026-03-30T09:30:00.000Z"),
        doctor: { fullName: "Dr. Bianchi" },
      },
      rule: {
        channel: NotificationChannel.EMAIL,
      },
      template: {
        subject: "Promemoria {{appointmentDate}}",
        body: "Ciao {{patientName}}, appuntamento alle {{appointmentTime}} con {{doctorName}}.\n\n{{button}}",
        buttonColor: "#0f766e",
      },
    });

    expect(plan.html).toMatch(/<table role="presentation"/);
    expect(plan.html).toMatch(/Apri dettaglio/);
    expect(plan.body).toContain("Rossi Mario");
    expect(plan.body).not.toMatch(/<a[\s>]/i);
  });
});
