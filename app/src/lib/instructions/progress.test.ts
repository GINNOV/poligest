import { describe, expect, it } from "vitest";
import { currentStepIndex, reconcileProgress } from "./progress";

describe("instruction progress", () => {
  it("drops step ids that no longer exist", () => {
    expect(reconcileProgress(["a", "gone"], ["a", "b"])).toEqual(["a"]);
  });

  it("returns the first incomplete step, or the length when all are done", () => {
    expect(currentStepIndex(["a", "b"], [])).toBe(0);
    expect(currentStepIndex(["a", "b"], ["a"])).toBe(1);
    expect(currentStepIndex(["a", "b"], ["a", "b"])).toBe(2);
  });
});
