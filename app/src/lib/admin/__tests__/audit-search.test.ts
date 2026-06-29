import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  buildAuditDateFilter,
  buildAuditLogFilters,
  normalizeAuditSearchQuery,
} from "@/lib/admin/audit-search";

describe("audit search helpers", () => {
  it("normalizes free-text search params", () => {
    expect(normalizeAuditSearchQuery("  mario  ")).toBe("mario");
    expect(normalizeAuditSearchQuery(["  rossi "])).toBe("rossi");
    expect(normalizeAuditSearchQuery(undefined)).toBe("");
  });

  it("builds an inclusive date range for a valid day", () => {
    const filter = buildAuditDateFilter("2026-06-29");
    expect(filter?.gte.getFullYear()).toBe(2026);
    expect(filter?.gte.getMonth()).toBe(5);
    expect(filter?.gte.getDate()).toBe(29);
    expect(filter?.lt.getDate()).toBe(30);
  });

  it("combines q, role, type, and date filters without legacy user picker params", () => {
    const filters = buildAuditLogFilters({
      q: "mario",
      date: "2026-06-29",
      role: Role.ADMIN,
      type: "patient.updated",
    });

    expect(filters).toHaveLength(5);
    expect(filters[1]).toEqual({
      OR: expect.arrayContaining([
        { action: { contains: "mario", mode: "insensitive" } },
        {
          user: {
            OR: [
              { email: { contains: "mario", mode: "insensitive" } },
              { name: { contains: "mario", mode: "insensitive" } },
            ],
          },
        },
      ]),
    });
    expect(filters[2]).toEqual({ createdAt: expect.any(Object) });
    expect(filters[3]).toEqual({ user: { role: Role.ADMIN } });
    expect(filters[4]).toEqual({ action: "patient.updated" });
  });
});