import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const logAudit = vi.fn();
  const revalidatePath = vi.fn();
  const prisma = {
    service: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  return { requireUser, logAudit, revalidatePath, prisma };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
  Prisma: {
    Decimal: class {
      constructor(public value: number | string) {}
      toString() {
        return String(this.value);
      }
    },
  },
}));

import { createService, deleteService, updateService } from "@/lib/admin/services-actions";

describe("services actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "admin-1", role: Role.ADMIN });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.prisma.service.create.mockResolvedValue({ id: "service-1" });
    mocks.prisma.service.update.mockResolvedValue({ id: "service-1" });
    mocks.prisma.service.delete.mockResolvedValue(undefined);
  });

  it("normalizes service names on create", async () => {
    const formData = new FormData();
    formData.set("name", "igiene orale");
    formData.set("costBasis", "80");

    await createService(formData);

    expect(mocks.prisma.service.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "🪥 IGIENE ORALE",
        costBasis: expect.anything(),
      }),
    });
  });

  it("normalizes service names on update", async () => {
    const formData = new FormData();
    formData.set("serviceId", "service-1");
    formData.set("name", "visita di controllo");
    formData.set("costBasis", "50");

    await updateService(formData);

    expect(mocks.prisma.service.update).toHaveBeenCalledWith({
      where: { id: "service-1" },
      data: expect.objectContaining({
        name: "📋 VISITA DI CONTROLLO",
      }),
    });
  });

  it("deletes a service and revalidates the admin page", async () => {
    const formData = new FormData();
    formData.set("serviceId", "service-9");

    await deleteService(formData);

    expect(mocks.prisma.service.delete).toHaveBeenCalledWith({ where: { id: "service-9" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/servizi");
  });
});