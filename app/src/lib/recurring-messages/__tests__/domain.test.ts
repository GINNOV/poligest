import { RecurringMessageKind, RecurringMessageStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildAdminBackupReminderBody,
  buildAdminBackupReminderCandidates,
  buildAdminBackupReminderHtml,
  buildRecurringCandidates,
  filterRecurringCandidates,
  getAdminBackupReminderMonthKey,
  materializeRecurringDelivery,
  mergeRecurringConfigs,
} from "@/lib/recurring-messages/domain";

describe("recurring messages domain", () => {
  it("builds holiday candidates within the due window", () => {
    const candidates = buildRecurringCandidates({
      now: new Date("2026-01-01T10:00:00.000Z"),
      configs: [
        {
          kind: RecurringMessageKind.HOLIDAY,
          enabled: true,
          subject: "Auguri {{holidayName}}",
          body: "Ciao {{firstName}}",
          daysBefore: null,
        },
      ],
      patients: [
        {
          id: "patient-1",
          email: "mario@example.com",
          firstName: "Mario",
          lastName: "Rossi",
          birthDate: null,
        },
      ],
      closures: [],
      holidays: [
        {
          key: "capodanno",
          name: "Capodanno",
          date: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.dedupeKey).toBe("holiday:capodanno:2026:patient-1");
  });

  it("builds closure and leap-year birthday candidates", () => {
    const candidates = buildRecurringCandidates({
      now: new Date("2025-02-26T10:00:00.000Z"),
      configs: [
        {
          kind: RecurringMessageKind.CLOSURE,
          enabled: true,
          subject: "Chiusura {{closureTitle}}",
          body: "Dal {{closureStart}} al {{closureEnd}}",
          daysBefore: 7,
        },
        {
          kind: RecurringMessageKind.BIRTHDAY,
          enabled: true,
          subject: "Auguri {{firstName}}",
          body: "Buon compleanno {{firstName}}",
          daysBefore: null,
        },
      ],
      patients: [
        {
          id: "patient-1",
          email: "mario@example.com",
          firstName: "Mario",
          lastName: "Rossi",
          birthDate: new Date("1988-02-29T00:00:00.000Z"),
        },
      ],
      closures: [
        {
          id: "closure-1",
          startsAt: new Date("2025-03-05T00:00:00.000Z"),
          endsAt: new Date("2025-03-07T00:00:00.000Z"),
          title: null,
        },
      ],
      holidays: [],
    });

    expect(candidates.some((candidate) => candidate.kind === RecurringMessageKind.CLOSURE)).toBe(
      true,
    );
    const birthdayCandidate = buildRecurringCandidates({
      now: new Date("2025-02-28T10:00:00.000Z"),
      configs: [
        {
          kind: RecurringMessageKind.BIRTHDAY,
          enabled: true,
          subject: "Auguri {{firstName}}",
          body: "Buon compleanno {{firstName}}",
          daysBefore: null,
        },
      ],
      patients: [
        {
          id: "patient-1",
          email: "mario@example.com",
          firstName: "Mario",
          lastName: "Rossi",
          birthDate: new Date("1988-02-29T00:00:00.000Z"),
        },
      ],
      closures: [],
      holidays: [],
    });

    expect(
      birthdayCandidate.find((candidate) => candidate.kind === RecurringMessageKind.BIRTHDAY)?.eventDate?.toISOString(),
    ).toBe("2025-02-28T00:00:00.000Z");
  });

  it("skips disabled configs and candidates outside the due window", () => {
    const candidates = buildRecurringCandidates({
      now: new Date("2026-01-02T10:00:00.000Z"),
      configs: [
        {
          kind: RecurringMessageKind.HOLIDAY,
          enabled: false,
          subject: "Auguri {{holidayName}}",
          body: "Ciao {{firstName}}",
          daysBefore: null,
        },
      ],
      patients: [
        {
          id: "patient-1",
          email: "mario@example.com",
          firstName: "Mario",
          lastName: "Rossi",
          birthDate: null,
        },
      ],
      closures: [],
      holidays: [
        {
          key: "capodanno",
          name: "Capodanno",
          date: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(candidates).toEqual([]);
  });

  it("filters sent and skipped candidates while retrying failed ones", () => {
    const filtered = filterRecurringCandidates({
      candidates: [
        {
          kind: RecurringMessageKind.HOLIDAY,
          patientId: "1",
          email: "a@example.com",
          scheduledFor: new Date(),
          dedupeKey: "a",
          templateVars: {},
          subject: "A",
          body: "A",
        },
        {
          kind: RecurringMessageKind.HOLIDAY,
          patientId: "2",
          email: "b@example.com",
          scheduledFor: new Date(),
          dedupeKey: "b",
          templateVars: {},
          subject: "B",
          body: "B",
        },
      ],
      existingStatuses: new Map([
        ["a", RecurringMessageStatus.SENT],
        ["b", RecurringMessageStatus.FAILED],
      ]),
      maxSend: 5,
    });

    expect(filtered.map((candidate) => candidate.dedupeKey)).toEqual(["b"]);
  });

  it("respects maxSend when filtering candidates", () => {
    const filtered = filterRecurringCandidates({
      candidates: [
        {
          kind: RecurringMessageKind.HOLIDAY,
          patientId: "1",
          email: "a@example.com",
          scheduledFor: new Date(),
          dedupeKey: "a",
          templateVars: {},
          subject: "A",
          body: "A",
        },
        {
          kind: RecurringMessageKind.HOLIDAY,
          patientId: "2",
          email: "b@example.com",
          scheduledFor: new Date(),
          dedupeKey: "b",
          templateVars: {},
          subject: "B",
          body: "B",
        },
      ],
      existingStatuses: new Map(),
      maxSend: 1,
    });

    expect(filtered.map((candidate) => candidate.dedupeKey)).toEqual(["a"]);
  });

  it("merges stored config overrides with defaults", () => {
    const merged = mergeRecurringConfigs([
      {
        kind: RecurringMessageKind.CLOSURE,
        enabled: false,
        subject: "Soggetto custom",
      },
    ]);

    const closure = merged.find((config) => config.kind === RecurringMessageKind.CLOSURE);
    expect(closure).toMatchObject({
      kind: RecurringMessageKind.CLOSURE,
      enabled: false,
      subject: "Soggetto custom",
      daysBefore: 7,
    });
  });

  it("builds one monthly backup reminder per admin when not already sent", () => {
    const candidates = buildAdminBackupReminderCandidates({
      now: new Date("2026-03-25T10:00:00.000Z"),
      admins: [
        { id: "admin-1", email: "admin@example.com", name: "Mario Rossi" },
        { id: "admin-2", email: "owner@example.com", name: null },
      ],
      existingAuditEntityIds: new Set(["admin-2:2026-03"]),
      adminResetUrl: "https://poligest.example.com/admin/reset",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      userId: "admin-1",
      auditEntityId: "admin-1:2026-03",
    });
    expect(candidates[0]?.subject).toContain("backup mensile");
    expect(candidates[0]?.body).toContain("Passaggi consigliati:");
    expect(candidates[0]?.html).toContain("Backup mensile SORRISO");
    expect(candidates[0]?.html).toContain("<ol");
  });

  it("formats the monthly key and italian backup instructions", () => {
    expect(getAdminBackupReminderMonthKey(new Date("2026-11-03T10:00:00.000Z"))).toBe(
      "2026-11",
    );

    const body = buildAdminBackupReminderBody({
      adminName: "Mario",
      adminResetUrl: "https://poligest.example.com/admin/reset",
      monthLabel: "novembre 2026",
    });

    expect(body).toContain("Ciao Mario,");
    expect(body).toContain("1. Accedi alla dashboard amministrativa di SORRISO.");
    expect(body).toContain('3. Nella cartella Esportazione, seleziona "Tutto il database".');
    expect(body).toContain(
      '4. Clicca "Genera il backup" e conserva il file su una chiavetta per usi futuri.',
    );
    expect(body).toContain("6. Verifica che i file si aprano correttamente");
    expect(body).toContain("https://poligest.example.com/admin/reset");

    const html = buildAdminBackupReminderHtml({
      adminName: "Mario",
      adminResetUrl: "https://poligest.example.com/admin/reset",
      monthLabel: "novembre 2026",
    });

    expect(html).toContain("Ciao <strong>Mario</strong>,");
    expect(html).toContain("Apri Admin &gt; Sistema: Database");
    expect(html).toContain('href="https://poligest.example.com/admin/reset"');
    expect(html).toContain("<ol");
  });

  it("materializes subject and body templates", () => {
    expect(
      materializeRecurringDelivery({
        kind: RecurringMessageKind.BIRTHDAY,
        patientId: "patient-1",
        email: "mario@example.com",
        scheduledFor: new Date(),
        dedupeKey: "birthday:2026:patient-1",
        templateVars: { firstName: "Mario" },
        subject: "Auguri {{firstName}}",
        body: "Ciao {{firstName}}",
      }),
    ).toEqual({
      subject: "Auguri Mario",
      body: "Ciao Mario",
    });
  });
});
