import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { buildStockMovementFilters } from "../stock-movement-filters";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  prisma: {
    product: {
      findMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../actions", () => ({
  addStockMovement: vi.fn(),
  deleteStockMovement: vi.fn(),
  updateStockMovement: vi.fn(),
}));

import MovimentiPage from "./page";

function collectText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectText(node.props.children);
  }

  return "";
}

function collectHrefs(node: React.ReactNode): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectHrefs);
  }

  if (React.isValidElement<{ href?: string; children?: React.ReactNode }>(node)) {
    return [
      ...(typeof node.props.href === "string" ? [node.props.href] : []),
      ...collectHrefs(node.props.children),
    ];
  }

  return [];
}

describe("MovimentiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.prisma.product.findMany.mockResolvedValue([
      { id: "product-1", name: "Impianto Bioteck" },
    ]);
    mocks.prisma.stockMovement.findMany.mockResolvedValue([
      {
        id: "movement-1",
        product: { name: "Impianto Bioteck" },
        patient: { firstName: "Mario", lastName: "Rossi" },
        quantity: 1,
        movement: "OUT",
        note: null,
        udiPi: "(17)291209(10)WO-031358",
        purchaseDate: new Date("2026-01-02T00:00:00"),
        interventionDate: new Date("2026-01-04T00:00:00"),
        interventionSite: "36",
        createdAt: new Date("2026-01-05T10:30:00"),
      },
    ]);
  });

  it("applies shared filters and keeps print/export links aligned with the visible list", async () => {
    const searchParams = { mq: "Rossi Mario", from: "2026-01-02", to: "2026-01-04" };

    const page = await MovimentiPage({
      searchParams: Promise.resolve(searchParams),
    });

    expect(mocks.prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildStockMovementFilters(searchParams).where,
        include: { product: true, patient: true },
      }),
    );

    const hrefs = collectHrefs(page);
    expect(hrefs).toContain(
      "/magazzino/print/movimenti?mq=Rossi+Mario&from=2026-01-02&to=2026-01-04",
    );
    expect(hrefs).toContain(
      "/api/magazzino/export?mq=Rossi+Mario&from=2026-01-02&to=2026-01-04",
    );

    const text = collectText(page);
    expect(text).toContain("Annulla");
    expect(text).toContain("Rossi");
    expect(text).toContain("Mario");
    expect(text).toContain("UDI-PI:");
    expect(text).toContain("(17)291209(10)WO-031358");
    expect(text).toContain("Acquisto:");
    expect(text).toContain("Intervento:");
    expect(text).toContain("Sede:");
    expect(text).toContain("36");
  });
});
