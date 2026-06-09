import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => {
  const prisma = {
    patient: {
      create: vi.fn(),
    },
  };

  return {
    prisma,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

describe("POST /api/patients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";
  });

  it("returns 401 if unauthorized (missing token)", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 if unauthorized (wrong token)", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "wrong_token",
      },
      body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 if firstName is missing", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "test_secret_token",
      },
      body: JSON.stringify({ lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("First name and last name are required");
  });

  it("creates patient successfully with valid token and fields", async () => {
    mocks.prisma.patient.create.mockResolvedValue({ id: "new-patient-id" });

    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "Authorization": "Bearer test_secret_token",
      },
      body: JSON.stringify({
        firstName: "Mario",
        lastName: "Rossi",
        birthDate: "05/03/1971",
        gender: "M",
        notes: "Some notes",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.patientId).toBe("new-patient-id");

    expect(mocks.prisma.patient.create).toHaveBeenCalledWith({
      data: {
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: null,
        birthDate: expect.any(Date),
        gender: "MALE",
        notes: "Some notes",
      },
    });
  });
});
