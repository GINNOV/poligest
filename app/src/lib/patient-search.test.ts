import { describe, expect, it } from "vitest";
import { getPatientOptionValue, resolvePatientFromQuery } from "@/lib/patient-search";

const patients = [
  { id: "1", fullName: "Raffaele Franco", phone: "111", taxId: null },
  { id: "2", fullName: "Raffaele Franco", phone: "222", taxId: null },
];

describe("getPatientOptionValue", () => {
  it("includes phone and tax id when available", () => {
    expect(getPatientOptionValue(patients[0])).toBe("Raffaele Franco (111)");
    expect(
      getPatientOptionValue({
        id: "3",
        fullName: "Mario Rossi",
        phone: "333",
        taxId: "RSSMRA80A01H501Z",
      }),
    ).toBe("Mario Rossi (333 - RSSMRA80A01H501Z)");
  });
});

describe("resolvePatientFromQuery", () => {
  it("resolves the selected duplicate when the disambiguated label is used", () => {
    expect(
      resolvePatientFromQuery(getPatientOptionValue(patients[1]), patients)?.id,
    ).toBe("2");
  });

  it("does not pick the first duplicate when only the shared name is typed", () => {
    expect(resolvePatientFromQuery("Raffaele Franco", patients)).toBeNull();
  });

  it("resolves a unique patient by name alone", () => {
    expect(
      resolvePatientFromQuery("Mario Rossi", [
        { id: "3", fullName: "Mario Rossi", phone: null, taxId: null },
      ])?.id,
    ).toBe("3");
  });
});