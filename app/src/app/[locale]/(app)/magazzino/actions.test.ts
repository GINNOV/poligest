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
    stockMovement: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
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

import {
  addStockMovement,
  createProduct,
  deleteStockMovement,
  updateStockMovement,
} from "@/app/[locale]/(app)/magazzino/actions";

describe("magazzino actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
    mocks.prisma.supplier.findFirst.mockResolvedValue({ id: "supplier-fallback" });
    mocks.prisma.supplier.create.mockResolvedValue({ id: "supplier-fallback" });
    mocks.prisma.product.create.mockResolvedValue({ id: "product-1" });
    mocks.prisma.stockMovement.create.mockResolvedValue({ id: "movement-1" });
    mocks.prisma.stockMovement.delete.mockResolvedValue({ id: "movement-1" });
    mocks.prisma.stockMovement.update.mockResolvedValue({ id: "movement-1" });
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/fornitori");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/prodotti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/impianti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/movimenti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/print/prodotti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/print/movimenti");
  });

  it("still requires a supplier for regular products", async () => {
    const formData = new FormData();

    formData.set("name", "Guanti");

    await expect(createProduct(formData)).rejects.toThrow("Nome e fornitore obbligatori");
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });

  it("creates stock movements with validated positive integer quantities and revalidates movement pages", async () => {
    const formData = new FormData();
    formData.set("productId", "product-1");
    formData.set("quantity", "2");
    formData.set("movement", "OUT");
    formData.set("note", "  sala 1  ");

    await addStockMovement(formData);

    expect(mocks.prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "product-1",
        quantity: 2,
        movement: "OUT",
        note: "sala 1",
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/movimenti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/print/movimenti");
  });

  it.each([
    ["negative quantity", "product-1", "-2", "IN"],
    ["decimal quantity", "product-1", "1.5", "IN"],
    ["invalid movement type", "product-1", "2", "SIDEWAYS"],
    ["missing product", "", "2", "IN"],
  ])("rejects invalid stock movement input: %s", async (_label, productId, quantity, movement) => {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("quantity", quantity);
    formData.set("movement", movement);

    await expect(addStockMovement(formData)).rejects.toThrow("Dati movimento non validi");
    expect(mocks.prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("updates stock movements with validated data and the acting user", async () => {
    const formData = new FormData();
    formData.set("movementId", "movement-1");
    formData.set("quantity", "3");
    formData.set("movement", "IN");

    await updateStockMovement(formData);

    expect(mocks.prisma.stockMovement.update).toHaveBeenCalledWith({
      where: { id: "movement-1" },
      data: {
        quantity: 3,
        movement: "IN",
        note: null,
        userId: "user-1",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/movimenti");
  });

  it("deletes stock movements and revalidates movement pages", async () => {
    const formData = new FormData();
    formData.set("movementId", "movement-1");

    await deleteStockMovement(formData);

    expect(mocks.prisma.stockMovement.delete).toHaveBeenCalledWith({
      where: { id: "movement-1" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/movimenti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/magazzino/print/movimenti");
  });
});
