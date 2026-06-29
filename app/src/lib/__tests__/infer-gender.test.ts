import { describe, expect, it } from "vitest";
import {
  inferGenderFromFirstName,
  inferGenderFromTaxId,
  resolveEffectiveGender,
} from "@/lib/infer-gender";

describe("inferGenderFromTaxId", () => {
  it("detects female gender from codice fiscale day code", () => {
    expect(inferGenderFromTaxId("RSSMRA80A41H501U")).toBe("FEMALE");
  });

  it("detects male gender from codice fiscale day code", () => {
    expect(inferGenderFromTaxId("RSSMRA80A01H501U")).toBe("MALE");
  });

  it("returns null for invalid tax ids", () => {
    expect(inferGenderFromTaxId("")).toBeNull();
    expect(inferGenderFromTaxId("SHORT")).toBeNull();
  });
});

describe("inferGenderFromFirstName", () => {
  it("recognizes common Italian female names", () => {
    expect(inferGenderFromFirstName("Maria")).toBe("FEMALE");
    expect(inferGenderFromFirstName("giulia")).toBe("FEMALE");
  });

  it("recognizes common Italian male names and exceptions ending in -a", () => {
    expect(inferGenderFromFirstName("Mario")).toBe("MALE");
    expect(inferGenderFromFirstName("Andrea")).toBe("MALE");
    expect(inferGenderFromFirstName("Mattia")).toBe("MALE");
  });

  it("uses ending heuristics for unknown names", () => {
    expect(inferGenderFromFirstName("Antonella")).toBe("FEMALE");
    expect(inferGenderFromFirstName("Filippo")).toBe("MALE");
  });
});

describe("resolveEffectiveGender", () => {
  it("prefers explicit gender over inference", () => {
    expect(resolveEffectiveGender("MALE", "Maria", "RSSMRA80A41H501U")).toBe("MALE");
  });

  it("infers from tax id when gender is not specified", () => {
    expect(resolveEffectiveGender("NOT_SPECIFIED", "Sconosciuto", "RSSMRA80A41H501U")).toBe("FEMALE");
  });

  it("infers from first name when gender and tax id are unavailable", () => {
    expect(resolveEffectiveGender("NOT_SPECIFIED", "Francesca", null)).toBe("FEMALE");
  });
});