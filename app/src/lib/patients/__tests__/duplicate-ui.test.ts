import { describe, expect, it } from "vitest";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import {
  canHardDeleteOthers,
  countNonEmptyPatients,
  getDuplicateFieldConflicts,
  getReviewGroupKind,
} from "@/lib/patients/duplicate-ui";

describe("getDuplicateFieldConflicts", () => {
  it("detects conflicting tax id and birth date", () => {
    const conflicts = getDuplicateFieldConflicts([
      {
        id: "a",
        email: "same@example.com",
        phone: "+393331111111",
        birthDate: new Date("1965-08-13T00:00:00.000Z"),
        taxId: "CRRMRS65M53F912U",
      },
      {
        id: "b",
        email: "same@example.com",
        phone: "+393331111111",
        birthDate: new Date("1962-03-01T00:00:00.000Z"),
        taxId: "PPPMHL62C01I438S",
      },
    ]);

    expect(conflicts.map((c) => c.field).sort()).toEqual(["birthDate", "taxId"]);
    expect(conflicts.find((c) => c.field === "email")).toBeUndefined();
  });

  it("ignores matching fields", () => {
    const conflicts = getDuplicateFieldConflicts([
      {
        id: "a",
        email: "a@example.com",
        phone: "333",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        taxId: "AAAAAA80A01H501U",
      },
      {
        id: "b",
        email: "A@example.com",
        phone: "333",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        taxId: "aaaaaa80a01h501u",
      },
    ]);
    expect(conflicts).toEqual([]);
  });
});

describe("review group helpers", () => {
  it("classifies multi-data groups", () => {
    expect(
      getReviewGroupKind({
        safe: false,
        nonEmptyCount: 2,
        conflicts: [],
      }),
    ).toBe("multi_data");
  });

  it("only allows hard-delete when every other is empty", () => {
    const counts = new Map([
      ["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }],
      ["shell", { ...EMPTY_ATTACHMENT_COUNTS }],
      ["rich", { ...EMPTY_ATTACHMENT_COUNTS, dentalRecordCount: 1 }],
    ]);
    expect(canHardDeleteOthers(["shell"], counts)).toBe(true);
    expect(canHardDeleteOthers(["rich"], counts)).toBe(false);
    expect(canHardDeleteOthers(["shell", "rich"], counts)).toBe(false);
  });

  it("counts non-empty patients fail-closed when counts missing", () => {
    const counts = new Map([["a", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }]]);
    expect(countNonEmptyPatients(["a", "b"], counts)).toBe(2);
  });
});
