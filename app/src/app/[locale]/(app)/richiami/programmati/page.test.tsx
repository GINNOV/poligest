import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, RecallStatus, Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const recallFindMany = vi.fn();
  const prisma = {
    recall: {
      count: vi.fn(),
      findMany: recallFindMany,
    },
    recallRule: {
      findMany: vi.fn(),
    },
    patient: {
      findMany: vi.fn(),
    },
  };

  return {
    prisma,
    recallFindMany,
    requireUser: vi.fn(),
    requireFeatureAccess: vi.fn(),
    getRoleFeatureAccess: vi.fn(),
    getAllEmailTemplates: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/feature-access", () => ({
  requireFeatureAccess: mocks.requireFeatureAccess,
  getRoleFeatureAccess: mocks.getRoleFeatureAccess,
}));

vi.mock("@/lib/email-templates", () => ({
  getAllEmailTemplates: mocks.getAllEmailTemplates,
}));

vi.mock("@/lib/recalls/delivery", () => ({
  getNotificationChannelLabels: () => ["Email"],
}));

vi.mock("@/app/[locale]/(app)/richiami/actions", () => ({
  deleteScheduledRecall: vi.fn(),
  dismissRecallDeliveryFailure: vi.fn(),
  markRecallAsContacted: vi.fn(),
  scheduleRecall: vi.fn(),
}));

vi.mock("@/components/patient-search-combobox", () => ({
  PatientSearchCombobox: () => null,
}));

vi.mock("@/components/recall-whatsapp-button", () => ({
  RecallWhatsappButton: () => null,
}));

vi.mock("@/components/recall-delivery-failure-alerts", () => ({
  RecallDeliveryFailureAlerts: () => null,
}));

import RichiamiProgrammatiPage from "./page";

function collectText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectText(node.props.children);
  }

  return "";
}

function missingDeliveryDismissalColumnError() {
  return new Prisma.PrismaClientKnownRequestError("Missing Recall.deliveryFailureDismissedAt", {
    clientVersion: "test",
    code: "P2022",
    meta: { modelName: "Recall", column: "Recall.deliveryFailureDismissedAt" },
  });
}

function unrelatedMissingColumnError() {
  return new Prisma.PrismaClientKnownRequestError("Missing Recall.someOtherColumn", {
    clientVersion: "test",
    code: "P2022",
    meta: { modelName: "Recall", column: "Recall.someOtherColumn" },
  });
}

describe("RichiamiProgrammatiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.getRoleFeatureAccess.mockResolvedValue({
      isAllowed: vi.fn().mockReturnValue(true),
    });
    mocks.prisma.recall.count.mockResolvedValue(1);
    mocks.recallFindMany
      .mockResolvedValueOnce([
        {
          id: "recall-1",
          dueAt: new Date("2026-07-12T00:00:00.000Z"),
          status: RecallStatus.PENDING,
          notes: null,
          patient: {
            id: "patient-1",
            firstName: "Annamaria",
            lastName: "Esposito",
            phone: "+393349469964",
          },
          rule: {
            id: "rule-1",
            name: "igiene trimestrale",
            serviceType: "Igiene",
            templateName: null,
            message: null,
            emailSubject: null,
            channel: "email",
          },
        },
      ])
      .mockRejectedValueOnce(missingDeliveryDismissalColumnError());
    mocks.prisma.recallRule.findMany.mockResolvedValue([
      {
        id: "rule-1",
        name: "igiene trimestrale",
        serviceType: "Igiene",
        intervalMonths: 3,
        templateName: null,
        message: null,
      },
    ]);
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        id: "patient-1",
        firstName: "Annamaria",
        lastName: "Esposito",
        phone: "+393349469964",
        notes: null,
      },
    ]);
    mocks.getAllEmailTemplates.mockResolvedValue([]);
  });

  it("renders scheduled recalls when the delivery dismissal column migration is missing", async () => {
    const page = await RichiamiProgrammatiPage({
      searchParams: Promise.resolve({}),
    });

    const text = collectText(page);

    expect(text).toContain("Richiami in scadenza");
    expect(text).toMatch(/1\s+richiami trovati/);
    expect(text).toContain("Esposito");
    expect(text).toContain("Annamaria");
  });

  it("rethrows unrelated missing-column errors from the delivery alert query", async () => {
    mocks.recallFindMany.mockReset();
    mocks.recallFindMany.mockResolvedValueOnce([]).mockRejectedValueOnce(unrelatedMissingColumnError());

    await expect(
      RichiamiProgrammatiPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Missing Recall.someOtherColumn");
  });
});
