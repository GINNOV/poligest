import { describe, expect, it } from "vitest";
import {
  formatServiceName,
  normalizeServiceBaseName,
  resolveServiceEmoji,
  serviceNamesMatch,
  stripServiceEmojiPrefix,
} from "@/lib/service-name";

describe("service-name", () => {
  it("uppercases and trims service base names", () => {
    expect(normalizeServiceBaseName("  igiene orale  ")).toBe("IGIENE ORALE");
    expect(normalizeServiceBaseName("🪥 Igiene orale")).toBe("IGIENE ORALE");
  });

  it("assigns contextual emojis", () => {
    expect(resolveServiceEmoji("IGIENE PROFESSIONALE")).toBe("🪥");
    expect(resolveServiceEmoji("VISITA DI CONTROLLO")).toBe("📋");
    expect(resolveServiceEmoji("OTTURAZIONE")).toBe("🔧");
    expect(resolveServiceEmoji("SERVIZIO GENERICO")).toBe("🦷");
  });

  it("formats names as emoji plus uppercase label", () => {
    expect(formatServiceName("igiene orale")).toBe("🪥 IGIENE ORALE");
    expect(formatServiceName("🦷 visita di controllo")).toBe("📋 VISITA DI CONTROLLO");
  });

  it("matches names regardless of emoji or casing", () => {
    expect(serviceNamesMatch("🪥 IGIENE", "igiene")).toBe(true);
    expect(serviceNamesMatch("Visita", "📋 VISITA DI CONTROLLO")).toBe(false);
  });

  it("strips emoji prefixes for editing", () => {
    expect(stripServiceEmojiPrefix("🪥 IGIENE ORALE")).toBe("IGIENE ORALE");
  });
});