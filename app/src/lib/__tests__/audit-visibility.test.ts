import { describe, expect, it } from "vitest";
import { auditLogVisibilityFilter } from "@/lib/audit";

describe("audit visibility", () => {
  it("excludes application errors from the operational audit feed", () => {
    expect(auditLogVisibilityFilter()).toEqual({
      action: {
        notIn: ["error.reported"],
      },
    });
  });
});