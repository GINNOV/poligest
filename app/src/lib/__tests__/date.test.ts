import { describe, expect, it } from "vitest";
import { formatOptionalDateInputValue, parseOptionalBirthDate, parseOptionalDate } from "@/lib/date";

describe("parseOptionalDate", () => {
  it("parses browser date input values", () => {
    expect(parseOptionalDate("1983-08-25")?.toISOString()).toBe("1983-08-25T00:00:00.000Z");
  });

  it("rejects malformed expanded years from date inputs", () => {
    expect(parseOptionalDate("81983-08-25")).toBeNull();
  });

  it("rejects future birth dates", () => {
    expect(() => parseOptionalBirthDate("2026-05-12", new Date("2026-05-11T12:00:00.000Z"))).toThrow(
      "La data di nascita non può essere futura.",
    );
  });

  it("rejects malformed birth dates", () => {
    expect(() => parseOptionalBirthDate("81983-08-25", new Date("2026-05-11T12:00:00.000Z"))).toThrow(
      "Data di nascita non valida.",
    );
  });

  it("formats valid date input values and ignores invalid persisted dates", () => {
    expect(formatOptionalDateInputValue(new Date("1983-08-25T00:00:00.000Z"))).toBe("1983-08-25");
    expect(formatOptionalDateInputValue(new Date("invalid-date"))).toBe("");
  });
});
