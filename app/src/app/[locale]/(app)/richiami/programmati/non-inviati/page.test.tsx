import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const isAllowed = vi.fn();
  return {
    isAllowed,
    prisma: {
      recall: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    },
    requireUser: vi.fn(),
    requireFeatureAccess: vi.fn(),
    getRoleFeatureAccess: vi.fn(),
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

vi.mock("@/app/[locale]/(app)/richiami/actions", () => ({
  dismissRecallDeliveryFailure: vi.fn(),
}));

import InviiNonRiuscitiPage from "./page";

const failedRecall = {
  id: "recall-1",
  dueAt: new Date("2026-07-06T08:00:00.000Z"),
  lastContactAt: new Date("2026-07-06T09:00:00.000Z"),
  patient: {
    id: "patient-9",
    firstName: "Mario",
    lastName: "Rossi",
    phone: null,
    email: null,
  },
  rule: { name: "Igiene", channel: "WHATSAPP" },
};

describe("InviiNonRiuscitiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.isAllowed.mockReturnValue(true);
    mocks.getRoleFeatureAccess.mockResolvedValue({ isAllowed: mocks.isAllowed });
    mocks.prisma.recall.count.mockResolvedValue(1);
    mocks.prisma.recall.findMany.mockResolvedValue([failedRecall]);
  });

  it("searches failed invites and links each row to the patient file", async () => {
    const page = await InviiNonRiuscitiPage({
      searchParams: Promise.resolve({ q: "rossi" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Invii non riusciti");
    expect(html).toContain('name="q"');
    expect(html).toContain('value="rossi"');
    expect(html).toContain("Rossi Mario");
    expect(html).toContain("Manca il numero di telefono.");
    expect(html).toContain('href="/pazienti/patient-9?openContact=1#contact-info"');
    expect(mocks.prisma.recall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        where: expect.objectContaining({
          status: "SKIPPED",
          deliveryFailureDismissedAt: null,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("hides the patient link when the role cannot open patient files", async () => {
    mocks.isAllowed.mockReturnValue(false);

    const page = await InviiNonRiuscitiPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).not.toContain("/pazienti/");
    expect(html).toContain("Chiudi");
  });
});
