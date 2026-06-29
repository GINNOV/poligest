import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    service: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return { prisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { syncServiceCatalogFormatting } from "@/lib/admin/service-catalog-sync";

describe("syncServiceCatalogFormatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (operations: unknown[]) => {
      for (const operation of operations) {
        await operation;
      }
    });
    mocks.prisma.service.update.mockResolvedValue(undefined);
  });

  it("updates only services whose names are not already formatted", async () => {
    mocks.prisma.service.findMany.mockResolvedValue([
      { id: "s-1", name: "igiene orale" },
      { id: "s-2", name: "🪥 IGIENE ORALE" },
      { id: "s-3", name: "VISITA" },
    ]);

    const result = await syncServiceCatalogFormatting();

    expect(result).toEqual({ updatedCount: 2 });
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.prisma.service.update).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.service.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { name: "🪥 IGIENE ORALE" },
    });
    expect(mocks.prisma.service.update).toHaveBeenCalledWith({
      where: { id: "s-3" },
      data: { name: "📋 VISITA" },
    });
  });

  it("skips the transaction when all names are already formatted", async () => {
    mocks.prisma.service.findMany.mockResolvedValue([
      { id: "s-1", name: "🪥 IGIENE ORALE" },
    ]);

    const result = await syncServiceCatalogFormatting();

    expect(result).toEqual({ updatedCount: 0 });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});