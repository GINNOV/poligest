import { describe, expect, it } from "vitest";
import { visiblePageNumbers } from "./pagination";

describe("visiblePageNumbers", () => {
  it("keeps a short window when there are many pages", () => {
    expect(visiblePageNumbers(1, 24)).toEqual([1, 2, 3, 4, "gap", 24]);
    expect(visiblePageNumbers(12, 24)).toEqual([1, "gap", 11, 12, 13, "gap", 24]);
    expect(visiblePageNumbers(24, 24)).toEqual([1, "gap", 21, 22, 23, 24]);
  });

  it("lists every page when the list is already short", () => {
    expect(visiblePageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
