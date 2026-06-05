import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { buildStockMovementFilters } from "./stock-movement-filters";

describe("buildStockMovementFilters", () => {
  it("builds a tokenized search so patient full names can match first and last name separately", () => {
    const filters = buildStockMovementFilters({ mq: "Rossi Mario" });

    expect(filters.movementQuery).toBe("Rossi Mario");
    expect(filters.where).toEqual({
      AND: [
        {
          OR: expect.arrayContaining([
            { patient: { is: { firstName: { contains: "Rossi", mode: Prisma.QueryMode.insensitive } } } },
            { patient: { is: { lastName: { contains: "Rossi", mode: Prisma.QueryMode.insensitive } } } },
          ]),
        },
        {
          OR: expect.arrayContaining([
            { patient: { is: { firstName: { contains: "Mario", mode: Prisma.QueryMode.insensitive } } } },
            { patient: { is: { lastName: { contains: "Mario", mode: Prisma.QueryMode.insensitive } } } },
          ]),
        },
      ],
    });
  });

  it("matches date filters against movement, purchase, and intervention dates", () => {
    const filters = buildStockMovementFilters({ from: "2026-01-02", to: "2026-01-04" });

    expect(filters.dateFrom).toEqual(new Date("2026-01-02T00:00:00"));
    expect(filters.dateTo).toEqual(new Date("2026-01-04T23:59:59.999"));
    expect(filters.where).toEqual({
      OR: [
        {
          createdAt: {
            gte: new Date("2026-01-02T00:00:00"),
            lte: new Date("2026-01-04T23:59:59.999"),
          },
        },
        {
          purchaseDate: {
            gte: new Date("2026-01-02T00:00:00"),
            lte: new Date("2026-01-04T23:59:59.999"),
          },
        },
        {
          interventionDate: {
            gte: new Date("2026-01-02T00:00:00"),
            lte: new Date("2026-01-04T23:59:59.999"),
          },
        },
      ],
    });
  });

  it("keeps invalid dates out of the Prisma where clause while preserving active UI state", () => {
    const filters = buildStockMovementFilters({ from: "bad-date" });

    expect(filters.dateFrom).toBeNull();
    expect(filters.hasFilters).toBe(true);
    expect(filters.where).toBeUndefined();
  });
});
