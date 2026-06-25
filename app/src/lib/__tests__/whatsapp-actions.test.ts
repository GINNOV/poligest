import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, prismaMock, clearCacheMock, sendTextMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  prismaMock: {
    kapsoWhatsAppConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  clearCacheMock: vi.fn(),
  sendTextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/kapso-config", () => ({
  KAPSO_WHATSAPP_CONFIG_ID: "kapso",
  clearKapsoWhatsAppConfigCache: clearCacheMock,
}));

vi.mock("@/lib/kapso-whatsapp", () => ({
  sendKapsoWhatsAppText: sendTextMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { saveKapsoWhatsAppConfig, sendTestWhatsApp } from "@/lib/admin/whatsapp-actions";

describe("whatsapp admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("returns validation error when phone number id is missing", async () => {
    prismaMock.kapsoWhatsAppConfig.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("apiKey", "token");
    formData.set("phoneNumberId", "");

    await expect(saveKapsoWhatsAppConfig(formData)).resolves.toEqual({
      error: "Inserisci token API e ID numero WhatsApp.",
    });
  });

  it("saves config and returns success", async () => {
    prismaMock.kapsoWhatsAppConfig.findUnique.mockResolvedValue(null);
    prismaMock.kapsoWhatsAppConfig.upsert.mockResolvedValue({});

    const formData = new FormData();
    formData.set("apiKey", "token");
    formData.set("phoneNumberId", "597907523413541");
    formData.set("displayPhoneNumber", "+393331112233");

    await expect(saveKapsoWhatsAppConfig(formData)).resolves.toEqual({ success: true });
    expect(clearCacheMock).toHaveBeenCalled();
  });

  it("returns validation error when test recipient is missing", async () => {
    const formData = new FormData();

    await expect(sendTestWhatsApp(formData)).resolves.toEqual({
      error: "Inserisci un numero di telefono.",
    });
  });

  it("sends test message and returns success", async () => {
    sendTextMock.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("to", "+393331112233");
    formData.set("body", "Ciao");

    await expect(sendTestWhatsApp(formData)).resolves.toEqual({ success: true });
    expect(sendTextMock).toHaveBeenCalledWith({ to: "+393331112233", body: "Ciao" });
  });

  it("returns a helpful message for inactive Kapso sandbox sessions", async () => {
    sendTextMock.mockRejectedValue(new Error("Active sandbox session required to send messages"));

    const formData = new FormData();
    formData.set("to", "+393331112233");

    const result = await sendTestWhatsApp(formData);
    expect(result.error).toContain("Sessione sandbox Kapso non attiva");
    expect(result.error).toContain("WhatsApp → Sandbox");
  });
});