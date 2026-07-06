import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    doctor: {
      findMany: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET } from "./route";

describe("GET /api/quicknotes/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";
    mocks.prisma.doctor.findMany.mockResolvedValue([]);
    mocks.prisma.supplier.findMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthorized", async () => {
    const response = await GET(new Request("http://localhost/api/quicknotes/contacts?kind=doctor"));

    expect(response.status).toBe(401);
  });

  it("returns 400 for unknown contact kinds", async () => {
    const response = await GET(
      new Request("http://localhost/api/quicknotes/contacts?kind=patient", {
        headers: { "x-api-key": "test_secret_token" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid contact kind" });
  });

  it("searches doctors and returns directory contacts", async () => {
    mocks.prisma.doctor.findMany.mockResolvedValue([
      {
        id: "doctor-1",
        fullName: "Dott.ssa Bianchi",
        specialty: "Ortodonzia",
        phone: "3330000000",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/quicknotes/contacts?kind=doctor&q=bianchi", {
        headers: { "x-api-key": "test_secret_token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contacts: [
        {
          id: "doctor-1",
          displayName: "Dott.ssa Bianchi",
          detail: "Ortodonzia · 3330000000",
        },
      ],
    });
    expect(mocks.prisma.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 80,
        where: {
          AND: [
            {
              OR: expect.arrayContaining([
                { fullName: { contains: "bianchi", mode: Prisma.QueryMode.insensitive } },
              ]),
            },
          ],
        },
      }),
    );
  });

  it("searches suppliers and returns directory contacts", async () => {
    mocks.prisma.supplier.findMany.mockResolvedValue([
      {
        id: "supplier-1",
        name: "Dental Supply",
        email: "ordini@example.com",
        phone: null,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/quicknotes/contacts?kind=supplier&q=dental", {
        headers: { "x-api-key": "test_secret_token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contacts: [
        {
          id: "supplier-1",
          displayName: "Dental Supply",
          detail: "ordini@example.com",
        },
      ],
    });
    expect(mocks.prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 80,
        where: {
          AND: [
            {
              OR: expect.arrayContaining([
                { name: { contains: "dental", mode: Prisma.QueryMode.insensitive } },
              ]),
            },
          ],
        },
      }),
    );
  });
});
