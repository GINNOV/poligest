import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    service: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET } from "./route";

describe("GET /api/quicknotes/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";
    mocks.prisma.service.findMany.mockResolvedValue([
      {
        id: "service-1",
        name: "Igiene",
        description: "Seduta di igiene",
        costBasis: { toString: () => "80.00" },
      },
      {
        id: "service-2",
        name: "Prima visita",
        description: null,
        costBasis: { toString: () => "60.00" },
      },
    ]);
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(new Request("http://localhost/api/quicknotes/services"));

    expect(response.status).toBe(401);
    expect(mocks.prisma.service.findMany).not.toHaveBeenCalled();
  });

  it("returns Sorriso services for authorized QuickNotes clients", async () => {
    const response = await GET(new Request("http://localhost/api/quicknotes/services", {
      headers: { "x-api-key": "test_secret_token" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.service.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        description: true,
        costBasis: true,
      },
      orderBy: { name: "asc" },
    });
    await expect(response.json()).resolves.toEqual({
      services: [
        {
          id: "service-1",
          name: "Igiene",
          description: "Seduta di igiene",
          costBasis: "80.00",
        },
        {
          id: "service-2",
          name: "Prima visita",
          description: null,
          costBasis: "60.00",
        },
      ],
    });
  });
});
