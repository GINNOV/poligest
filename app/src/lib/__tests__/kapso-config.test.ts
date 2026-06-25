import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kapsoWhatsAppConfig: {
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  clearKapsoWhatsAppConfigCache,
  getKapsoWhatsAppConfig,
  maskKapsoValue,
} from "@/lib/kapso-config";

describe("kapso config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearKapsoWhatsAppConfigCache();
    delete process.env.KAPSO_API_KEY;
    delete process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.KAPSO_WHATSAPP_DISPLAY_PHONE_NUMBER;
  });

  it("prefers database configuration over environment variables", async () => {
    process.env.KAPSO_API_KEY = "env-token";
    process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID = "env-phone-id";
    mocks.findUnique.mockResolvedValue({
      apiKey: "db-token",
      phoneNumberId: "db-phone-id",
      displayPhoneNumber: "+393331234567",
    });

    await expect(getKapsoWhatsAppConfig()).resolves.toEqual({
      apiKey: "db-token",
      phoneNumberId: "db-phone-id",
      displayPhoneNumber: "+393331234567",
      source: "db",
    });
  });

  it("falls back to environment variables when database config is missing", async () => {
    process.env.KAPSO_API_KEY = "env-token";
    process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID = "env-phone-id";
    mocks.findUnique.mockResolvedValue(null);

    await expect(getKapsoWhatsAppConfig()).resolves.toEqual({
      apiKey: "env-token",
      phoneNumberId: "env-phone-id",
      displayPhoneNumber: null,
      source: "env",
    });
  });

  it("masks sensitive values for admin display", () => {
    expect(maskKapsoValue("0215c68459cab4125ba5089b6ffaeec1e2d18d042bab32910052854ad2063695")).toMatch(
      /^0215\*+95$/,
    );
  });
});