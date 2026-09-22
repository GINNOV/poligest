import { describe, expect, it } from "vitest";
import {
  compareInstructionsByCategoryThenTitle,
  inferInstructionCategoryFromPath,
  instructionCategoryLabel,
  instructionCategorySortRank,
  isInstructionCategoryId,
  normalizeInstructionCategory,
} from "./categories";

describe("instruction categories", () => {
  it("normalizes unknown values to GENERALE", () => {
    expect(normalizeInstructionCategory(undefined)).toBe("GENERALE");
    expect(normalizeInstructionCategory("NOPE")).toBe("GENERALE");
    expect(isInstructionCategoryId("PAZIENTI")).toBe(true);
    expect(isInstructionCategoryId("x")).toBe(false);
  });

  it("labels and ranks known areas", () => {
    expect(instructionCategoryLabel("MAGAZZINO")).toBe("Magazzino");
    expect(instructionCategorySortRank("GIORNATA")).toBeLessThan(
      instructionCategorySortRank("AGENDA"),
    );
    expect(instructionCategorySortRank("AGENDA")).toBeLessThan(
      instructionCategorySortRank("GENERALE"),
    );
  });

  it("infers category from path patterns", () => {
    expect(inferInstructionCategoryFromPath("/dashboard")).toBe("GIORNATA");
    expect(inferInstructionCategoryFromPath("/pazienti/*")).toBe("PAZIENTI");
    expect(inferInstructionCategoryFromPath("/magazzino")).toBe("MAGAZZINO");
    expect(inferInstructionCategoryFromPath("/magazzino/prodotti")).toBe(
      "MAGAZZINO",
    );
    expect(inferInstructionCategoryFromPath("/admin/*")).toBe("AMMINISTRAZIONE");
  });

  it("sorts by category then Italian title", () => {
    const rows = [
      { title: "Zebra", category: "AGENDA" },
      { title: "Alfa", category: "AGENDA" },
      { title: "Beta", category: "GIORNATA" },
      { title: "Gamma", category: "GENERALE" },
    ];
    const sorted = [...rows].sort(compareInstructionsByCategoryThenTitle);
    expect(sorted.map((r) => r.title)).toEqual(["Beta", "Alfa", "Zebra", "Gamma"]);
  });
});
