import { describe, expect, it } from "vitest";
import {
  EMPTY_ATTACHMENT_COUNTS,
  isPatientEmptyShell,
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
