import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

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
});
