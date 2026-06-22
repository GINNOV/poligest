import { describe, expect, it } from "vitest";
import { STU_430_ASPECT, computeWacomDialogSize } from "./wacom-capture";

describe("computeWacomDialogSize", () => {
  it("keeps the STU-430 aspect ratio", () => {
    const size = computeWacomDialogSize({ width: 1280, height: 800 });

    expect(size.width / size.height).toBeCloseTo(STU_430_ASPECT, 5);
    expect(size.width).toBeLessThanOrEqual(560);
    expect(size.height).toBeLessThanOrEqual(420);
  });

  it("shrinks to fit short viewports", () => {
    const size = computeWacomDialogSize({ width: 900, height: 500 });

    expect(size.height).toBeLessThanOrEqual(380);
    expect(size.width).toBeLessThanOrEqual(560);
  });
});