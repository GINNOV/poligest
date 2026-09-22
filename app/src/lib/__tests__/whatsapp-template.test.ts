import { describe, expect, it } from "vitest";
import { MESSAGE_PLACEHOLDER_KEYS } from "@/lib/placeholder-data";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";

describe("renderWhatsappTemplate", () => {
  it("replaces every message placeholder", () => {
    const template = MESSAGE_PLACEHOLDER_KEYS.map((key) => `{{${key}}}`).join(" ");
    const rendered = renderWhatsappTemplate(template, {
      firstName: "Mario",
      lastName: "Rossi",
      doctorName: "Dr. Bianchi",
      appointmentDate: "12/03/2026 09:30",
      serviceType: "Igiene",
      notes: "Portare gli esami",
    });

    expect(rendered).toBe("Mario Rossi Dr. Bianchi 12/03/2026 09:30 Igiene Portare gli esami");
    expect(rendered).not.toContain("{{");
  });
});
