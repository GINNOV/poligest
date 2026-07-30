import { describe, expect, it } from "vitest";
import {
  EMPTY_ATTACHMENT_COUNTS,
  isPatientEmptyShell,
  sumAttachmentScore,
  type FullPatientAttachmentCounts,
} from "@/lib/patients/duplicate-attachments";

const empty: FullPatientAttachmentCounts = { ...EMPTY_ATTACHMENT_COUNTS };

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
});
