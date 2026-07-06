import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPatientForMacosScan: vi.fn(),
  prisma: {
    patient: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/patients/macos-patient-sync", () => ({
  findPatientForMacosScan: mocks.findPatientForMacosScan,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { POST } from "./route";

describe("POST /api/patients/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";
    mocks.findPatientForMacosScan.mockResolvedValue(null);
    mocks.prisma.patient.findMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthorized", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns exists false when no patient matches", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: false });
  });

  it("matches an exact patient name when birth date and tax id are not available", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([{
      id: "patient-name-only",
      firstName: "Mario",
      lastName: "Rossi",
      birthDate: new Date("1980-01-02T00:00:00.000Z"),
      phone: "+3900000000",
      email: null,
    }]);

    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: true,
      patientId: "patient-name-only",
      matchKind: "name",
      candidates: [{
        patientId: "patient-name-only",
        displayName: "Rossi Mario",
        detail: "1980-01-02 · +3900000000",
      }],
    });
    expect(mocks.prisma.patient.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            firstName: { equals: "Mario", mode: "insensitive" },
            lastName: { equals: "Rossi", mode: "insensitive" },
          },
          {
            firstName: { equals: "Rossi", mode: "insensitive" },
            lastName: { equals: "Mario", mode: "insensitive" },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        phone: true,
        email: true,
      },
      orderBy: { createdAt: "asc" },
      take: 6,
    });
  });

  it("returns candidate rows for ambiguous exact names", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        birthDate: new Date("1980-01-02T00:00:00.000Z"),
        phone: null,
        email: "mario@example.com",
      },
      {
        id: "patient-2",
        firstName: "Mario",
        lastName: "Rossi",
        birthDate: new Date("1990-03-04T00:00:00.000Z"),
        phone: "+3911111111",
        email: null,
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: false,
      matchKind: "ambiguous",
      candidates: [
        {
          patientId: "patient-1",
          displayName: "Rossi Mario",
          detail: "1980-01-02 · mario@example.com",
        },
        {
          patientId: "patient-2",
          displayName: "Rossi Mario",
          detail: "1990-03-04 · +3911111111",
        },
      ],
    });
  });

  it("returns similar name candidates when no exact name matches", async () => {
    mocks.prisma.patient.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "patient-similar",
        firstName: "Mario",
        lastName: "Rossini",
        birthDate: null,
        phone: null,
        email: "rossini@example.com",
      }]);

    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: false,
      matchKind: "similar",
      candidates: [{
        patientId: "patient-similar",
        displayName: "Rossini Mario",
        detail: "rossini@example.com",
      }],
    });
  });

  it("returns the matched patient id", async () => {
    mocks.findPatientForMacosScan.mockResolvedValue({
      patientId: "patient-1",
      matchKind: "taxId",
    });

    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({
          firstName: "Mario",
          lastName: "Rossi",
          codiceFiscale: "RSSMRA90A15H501Y",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: true,
      patientId: "patient-1",
      matchKind: "taxId",
    });
  });
});
