import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appointment: { groupBy: vi.fn() },
  appointmentReminder: { groupBy: vi.fn() },
  patientPayment: { groupBy: vi.fn() },
  quote: { groupBy: vi.fn() },
  cashAdvance: { groupBy: vi.fn() },
  financeEntry: { groupBy: vi.fn() },
  dentalRecord: { groupBy: vi.fn() },
  clinicalNote: { groupBy: vi.fn() },
  patientConsent: { groupBy: vi.fn() },
  recall: { groupBy: vi.fn() },
  recurringMessageLog: { groupBy: vi.fn() },
  stockMovement: { groupBy: vi.fn() },
  smsLog: { groupBy: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks,
}));

import {
  EMPTY_ATTACHMENT_COUNTS,
  isPatientEmptyShell,
  loadFullAttachmentCounts,
  type FullPatientAttachmentCounts,
  sumAttachmentScore,
  toLegacyAttachmentCounts,
} from "@/lib/patients/duplicate-attachments";

const empty: FullPatientAttachmentCounts = {
  appointmentCount: 0,
  appointmentReminderCount: 0,
  paymentCount: 0,
  quoteCount: 0,
  cashAdvanceCount: 0,
  financeEntryCount: 0,
  dentalRecordCount: 0,
  clinicalNoteCount: 0,
  consentCount: 0,
  recallCount: 0,
  recurringMessageLogCount: 0,
  stockMovementCount: 0,
  smsLogCount: 0,
};

function mockAllGroupByEmpty() {
  for (const model of Object.values(mocks)) {
    model.groupBy.mockResolvedValue([]);
  }
}

describe("EMPTY_ATTACHMENT_COUNTS", () => {
  it("matches the zeroed full count shape", () => {
    expect(EMPTY_ATTACHMENT_COUNTS).toEqual(empty);
  });
});

describe("isPatientEmptyShell", () => {
  it("is true when all counts are zero", () => {
    expect(isPatientEmptyShell(empty)).toBe(true);
  });

  it("is false when any linked row exists", () => {
    expect(isPatientEmptyShell({ ...empty, appointmentCount: 1 })).toBe(false);
    expect(isPatientEmptyShell({ ...empty, paymentCount: 2 })).toBe(false);
  });
});

describe("sumAttachmentScore", () => {
  it("sums all attachment counters", () => {
    expect(sumAttachmentScore({ ...empty, paymentCount: 2, dentalRecordCount: 1 })).toBe(3);
  });

  it("includes every attachment field", () => {
    const full: FullPatientAttachmentCounts = {
      appointmentCount: 1,
      appointmentReminderCount: 1,
      paymentCount: 1,
      quoteCount: 1,
      cashAdvanceCount: 1,
      financeEntryCount: 1,
      dentalRecordCount: 1,
      clinicalNoteCount: 1,
      consentCount: 1,
      recallCount: 1,
      recurringMessageLogCount: 1,
      stockMovementCount: 1,
      smsLogCount: 1,
    };
    expect(sumAttachmentScore(full)).toBe(13);
  });
});

describe("toLegacyAttachmentCounts", () => {
  it("projects payment and dental record counts", () => {
    expect(
      toLegacyAttachmentCounts({
        ...empty,
        paymentCount: 4,
        dentalRecordCount: 2,
        appointmentCount: 9,
      }),
    ).toEqual({ paymentCount: 4, dentalRecordCount: 2 });
  });
});

describe("loadFullAttachmentCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllGroupByEmpty();
  });

  it("returns an empty map when patientIds is empty", async () => {
    const counts = await loadFullAttachmentCounts([]);

    expect(counts.size).toBe(0);
    expect(mocks.appointment.groupBy).not.toHaveBeenCalled();
    expect(mocks.patientPayment.groupBy).not.toHaveBeenCalled();
  });

  it("fills mocked groupBy fields and leaves others at zero", async () => {
    mocks.patientPayment.groupBy.mockResolvedValue([
      { patientId: "p1", _count: { _all: 3 } },
    ]);
    mocks.dentalRecord.groupBy.mockResolvedValue([
      { patientId: "p1", _count: { _all: 2 } },
    ]);
    mocks.appointment.groupBy.mockResolvedValue([
      { patientId: "p1", _count: { _all: 1 } },
    ]);

    const counts = await loadFullAttachmentCounts(["p1"]);

    expect(counts.get("p1")).toEqual({
      ...EMPTY_ATTACHMENT_COUNTS,
      paymentCount: 3,
      dentalRecordCount: 2,
      appointmentCount: 1,
    });
  });

  it("ignores group rows with null patientId", async () => {
    mocks.stockMovement.groupBy.mockResolvedValue([
      { patientId: null, _count: { _all: 9 } },
      { patientId: "p1", _count: { _all: 1 } },
    ]);
    mocks.financeEntry.groupBy.mockResolvedValue([
      { patientId: null, _count: { _all: 5 } },
    ]);

    const counts = await loadFullAttachmentCounts(["p1"]);

    expect(counts.get("p1")).toEqual({
      ...EMPTY_ATTACHMENT_COUNTS,
      stockMovementCount: 1,
    });
  });
});
