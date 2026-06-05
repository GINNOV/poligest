import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import React from "react";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  prisma: {
    product: {
      findMany: vi.fn(),
    },
    supplier: {
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

vi.mock("./actions", () => ({
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

import ProductManagementPage from "./product-management-page";

function collectElements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectElements);
  }

  if (React.isValidElement<Record<string, unknown>>(node)) {
    const children = node.props.children as React.ReactNode;
    return [node, ...collectElements(children)];
  }

  return [];
}

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

describe("ProductManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        name: "Guanti",
        supplierId: "supplier-1",
        sku: null,
        brand: null,
        serviceType: "materiale",
        minThreshold: 0,
        udiDi: null,
        udiPi: null,
        stockMovements: [],
      },
    ]);
    mocks.prisma.supplier.findMany.mockResolvedValue([
      { id: "supplier-1", name: "Bioteck" },
    ]);
  });

  it("loads only non-implant products on the products route", async () => {
    await ProductManagementPage({
      mode: "products",
      searchParams: Promise.resolve({}),
    });

    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              NOT: {
                OR: [
                  { name: { contains: "impianto", mode: "insensitive" } },
                  { serviceType: { contains: "impianto", mode: "insensitive" } },
                ],
              },
            },
          ],
        },
      }),
    );
  });

  it("loads only implants on the implants route", async () => {
    await ProductManagementPage({
      mode: "implants",
      searchParams: Promise.resolve({}),
    });

    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: "impianto", mode: "insensitive" } },
                { serviceType: { contains: "impianto", mode: "insensitive" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("requires supplier and UDI codes when registering implants", async () => {
    const page = await ProductManagementPage({
      mode: "implants",
      searchParams: Promise.resolve({}),
    });
    const elements = collectElements(page);
    const fields = elements.filter((element) =>
      ["name", "supplierId", "udiDi", "udiPi"].includes(String(element.props.name ?? "")),
    );

    expect(fields.filter((element) => element.props.name === "name").every((element) => element.props.required)).toBe(true);
    expect(fields.filter((element) => element.props.name === "supplierId").every((element) => element.props.required)).toBe(true);
    expect(fields.filter((element) => element.props.name === "udiDi").every((element) => element.props.required)).toBe(true);
    expect(fields.filter((element) => element.props.name === "udiPi").every((element) => element.props.required)).toBe(true);
    expect(collectText(page)).not.toContain("Fornitore non specificato");
  });
});
