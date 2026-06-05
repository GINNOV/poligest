import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    supplier: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    product: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { createProduct } from "@/app/[locale]/(app)/magazzino/actions";

describe("magazzino actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
    mocks.prisma.supplier.findFirst.mockResolvedValue({ id: "supplier-fallback" });
    mocks.prisma.supplier.create.mockResolvedValue({ id: "supplier-fallback" });
    mocks.prisma.product.create.mockResolvedValue({ id: "product-1" });
  });

  it("creates implant products without a selected supplier and keeps long UDI codes", async () => {
    const udiDi = "(01)72901086921981";
    const udiPi = "(17)291209(10)WO-031358(21)22-70007";
    const formData = new FormData();

    formData.set("isImplant", "1");
    formData.set("name", "IMPIANTO 2026");
    formData.set("udiDi", udiDi);
    formData.set("udiPi", udiPi);
    formData.set("minThreshold", "0");

    await createProduct(formData);

    expect(mocks.prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Fornitore non specificato", mode: "insensitive" } },
    });
    expect(mocks.prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "IMPIANTO 2026",
        serviceType: "impianto",
        supplierId: "supplier-fallback",
        udiDi,
        udiPi,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/prodotti");
  });

  it("still requires a supplier for regular products", async () => {
    const formData = new FormData();

    formData.set("name", "Guanti");

    await expect(createProduct(formData)).rejects.toThrow("Nome e fornitore obbligatori");
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });
});
