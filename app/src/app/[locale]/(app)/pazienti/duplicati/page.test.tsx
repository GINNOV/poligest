import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { completeDuplicatePatient, invalidBirthDatePatient } from "../../../../../../tests/fixtures/patient-records";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const groupBy = vi.fn().mockResolvedValue([]);
  const prisma = {
    patient: {
      findMany: vi.fn(),
    },
    appointment: { groupBy },
    appointmentReminder: { groupBy },
    patientPayment: { groupBy },
    quote: { groupBy },
    cashAdvance: { groupBy },
    financeEntry: { groupBy },
    dentalRecord: { groupBy },
    clinicalNote: { groupBy },
    patientConsent: { groupBy },
    recall: { groupBy },
    recurringMessageLog: { groupBy },
    stockMovement: { groupBy },
    smsLog: { groupBy },
    auditLog: {
      findMany: vi.fn(),
    },
  };

  return { requireUser, requireFeatureAccess, prisma, groupBy };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/feature-access", () => ({
  requireFeatureAccess: mocks.requireFeatureAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/user-display-time-zone.server", () => ({
  getUserDisplayTimeZone: vi.fn().mockResolvedValue("Europe/Rome"),
}));

vi.mock("@/lib/practice-settings", () => ({
  getAutoMergeEmptyDuplicates: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/components/patient-duplicate-resolve-button", () => ({
  PatientDuplicateResolveButton: () => null,
}));

vi.mock("@/components/patient-duplicate-merge-button", () => ({
  PatientDuplicateMergeButton: () => null,
}));

vi.mock("@/components/patient-duplicate-bulk-merge-button", () => ({
  PatientDuplicateBulkMergeButton: () => null,
}));

vi.mock("@/components/auto-merge-duplicates-setting", () => ({
  AutoMergeDuplicatesSetting: () => null,
}));

vi.mock("@/components/patient-delete-button", () => ({
  PatientDeleteButton: () => null,
}));

import PazientiDuplicatiPage from "./page";

describe("PazientiDuplicatiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.groupBy.mockResolvedValue([]);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it("renders duplicate groups when one persisted birth date is invalid", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      { ...invalidBirthDatePatient, taxId: null, gender: "NOT_SPECIFIED", photoUrl: null, hasPaperConsentForRequired: false },
      { ...completeDuplicatePatient, taxId: null, gender: "NOT_SPECIFIED", photoUrl: null, hasPaperConsentForRequired: false },
    ]);

    await expect(
      PazientiDuplicatiPage({
        searchParams: Promise.resolve({ q: "catapano" }),
      }),
    ).resolves.toBeTruthy();
  });

  it("shows multi-data review messaging and conflict table for dual-rich cards", async () => {
    const sharedEmail = "michele.pappacena62@gmail.com";
    const sharedPhone = "+393384337409";
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        id: "patient-a",
        firstName: "Michele",
        lastName: "Pappacena",
        email: sharedEmail,
        phone: sharedPhone,
        birthDate: new Date("1965-08-13T00:00:00.000Z"),
        taxId: "CRRMRS65M53F912U",
        gender: "MALE",
        notes: null,
        photoUrl: null,
        hasPaperConsentForRequired: false,
        createdAt: new Date("2026-07-04T11:10:00.000Z"),
      },
      {
        id: "patient-b",
        firstName: "Michele",
        lastName: "Pappacena",
        email: sharedEmail,
        phone: sharedPhone,
        birthDate: new Date("1962-03-01T00:00:00.000Z"),
        taxId: "PPPMHL62C01I438S",
        gender: "MALE",
        notes: null,
        photoUrl: null,
        hasPaperConsentForRequired: false,
        createdAt: new Date("2026-07-10T13:28:00.000Z"),
      },
    ]);
    mocks.prisma.patientPayment.groupBy.mockResolvedValue([
      { patientId: "patient-a", _count: { _all: 2 } },
      { patientId: "patient-b", _count: { _all: 1 } },
    ]);
    mocks.prisma.dentalRecord.groupBy.mockResolvedValue([
      { patientId: "patient-a", _count: { _all: 3 } },
      { patientId: "patient-b", _count: { _all: 2 } },
    ]);

    const ui = await PazientiDuplicatiPage({
      searchParams: Promise.resolve({}),
    });
    const text = collectText(ui);

    expect(text).toContain("Da rivedere — entrambe con dati");
    expect(text).toContain("Entrambe le schede hanno dati collegati");
    expect(text).toContain("Codice fiscale");
    expect(text).toContain("CRRMRS65M53F912U");
    expect(text).toContain("PPPMHL62C01I438S");
    expect(text).toContain("Riferimento (solo ranking)");
    expect(text).toContain("Da confrontare");
    expect(text).not.toContain("Elimina duplicati");
    expect(text).not.toContain("Mantieni questa, elimina le vuote");
  });
});

function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return collectText(props?.children);
  }
  return "";
}
