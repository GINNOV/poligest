import { describe, expect, it } from "vitest";
import {
  buildServiceSearchFilter,
  findExactServiceNameMatch,
  normalizeServiceSearchQuery,
} from "@/lib/admin/services-search";

describe("services search helpers", () => {
  it("normalizes query params", () => {
    expect(normalizeServiceSearchQuery("  Igiene  ")).toBe("Igiene");
    expect(normalizeServiceSearchQuery([" Visita "])).toBe("Visita");
    expect(normalizeServiceSearchQuery(undefined)).toBe("");
  });

  it("builds case-insensitive name and description filters", () => {
    expect(buildServiceSearchFilter("")).toBeUndefined();
    expect(buildServiceSearchFilter("igiene")).toEqual({
      OR: [
        { name: { contains: "igiene", mode: "insensitive" } },
        { description: { contains: "igiene", mode: "insensitive" } },
      ],
    });
  });

  it("detects exact name matches for duplicate checks", () => {
    const services = [
      { id: "s-1", name: "Igiene professionale" },
      { id: "s-2", name: "Visita" },
    ];

    expect(findExactServiceNameMatch(services, "visita")?.id).toBe("s-2");
    expect(findExactServiceNameMatch(services, "igiene")).toBeNull();
  });
});