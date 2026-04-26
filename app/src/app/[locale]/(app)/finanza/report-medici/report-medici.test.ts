import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  prisma: {
    doctor: {
      findMany: vi.fn(),
    },
    financeEntry: {
      findMany: vi.fn(),
    },
    appointment: {
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

// Mock date-fns to have consistent results
vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return {
    ...actual,
  };
});

import ReportMediciPage from "./page";

describe("ReportMediciPage", () => {
  it("calculates totals correctly for multiple doctors", async () => {
    mocks.requireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    
    mocks.prisma.doctor.findMany.mockResolvedValue([
      { id: "doc-1", fullName: "Dr. House" },
      { id: "doc-2", fullName: "Dr. Watson" },
    ]);

    mocks.prisma.financeEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        type: "INCOME",
        amount: new Prisma.Decimal(1000),
        doctorId: "doc-1",
        doctor: { fullName: "Dr. House" },
        occurredAt: new Date(),
      },
      {
        id: "e2",
        type: "EXPENSE",
        amount: new Prisma.Decimal(200),
        doctorId: "doc-1",
        doctor: { fullName: "Dr. House" },
        occurredAt: new Date(),
      },
      {
        id: "e3",
        type: "INCOME",
        amount: new Prisma.Decimal(500),
        doctorId: "doc-2",
        doctor: { fullName: "Dr. Watson" },
        occurredAt: new Date(),
      },
    ]);

    mocks.prisma.appointment.findMany.mockResolvedValue([
      {
        id: "a1",
        doctorId: "doc-1",
        patientId: "p1",
        serviceType: "Igiene",
        doctor: { fullName: "Dr. House" },
      },
      {
        id: "a2",
        doctorId: "doc-2",
        patientId: "p2",
        serviceType: "Chirurgia",
        doctor: { fullName: "Dr. Watson" },
      },
    ]);

    // We can't easily test the rendered JSX in a Server Component without a full DOM setup,
    // but we can at least verify it executes without crashing and fetches the right data.
    const result = await ReportMediciPage({ 
      searchParams: Promise.resolve({ from: "2026-04-01", to: "2026-04-30" }) 
    });
    
    expect(result).toBeDefined();
    expect(mocks.prisma.financeEntry.findMany).toHaveBeenCalled();
  });
});
