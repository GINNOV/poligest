import { describe, expect, it } from "vitest";
import { slotDurationClass } from "@/components/appointment-duration-chips";

describe("slotDurationClass", () => {
  it("uses the same duration bands as the visit-length chips", () => {
    expect(slotDurationClass(5, false)).toContain("bg-amber-300");
    expect(slotDurationClass(15, false)).toContain("bg-sky-300");
    expect(slotDurationClass(30, false)).toContain("bg-emerald-300");
    expect(slotDurationClass(60, false)).toContain("bg-violet-300");
  });

  it("marks the chosen slot with a darker fill of the same hue", () => {
    expect(slotDurationClass(15, true)).toContain("bg-sky-700");
    expect(slotDurationClass(15, true)).not.toContain("bg-sky-50");
    expect(slotDurationClass(5, true)).toContain("bg-amber-500");
  });
});
