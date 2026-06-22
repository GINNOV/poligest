import { prisma } from "@/lib/prisma";

export const WACOM_CONFIG_ID = "default";

export type WacomLicenseConfig = {
  licenseKey: string;
  licenseSecret: string;
  source: "db" | "env";
};

let cachedConfig: { value: WacomLicenseConfig | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0,
};

function readEnvLicense(): WacomLicenseConfig | null {
  const licenseKey =
    process.env.WACOM_SIGNATURE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_WACOM_SIGNATURE_KEY?.trim() ||
    "";
  const licenseSecret =
    process.env.WACOM_SIGNATURE_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_WACOM_SIGNATURE_SECRET?.trim() ||
    "";

  if (!licenseKey || !licenseSecret) return null;

  return {
    licenseKey,
    licenseSecret,
    source: "env",
  };
}

export function clearWacomConfigCache() {
  cachedConfig = { value: null, fetchedAt: 0 };
}

export async function getWacomLicenseConfig(): Promise<WacomLicenseConfig | null> {
  const now = Date.now();
  if (cachedConfig.value && now - cachedConfig.fetchedAt < 5 * 60 * 1000) {
    return cachedConfig.value;
  }

  const dbConfig = await prisma.wacomConfig.findUnique({
    where: { id: WACOM_CONFIG_ID },
  });

  const value: WacomLicenseConfig | null = dbConfig
    ? {
        licenseKey: dbConfig.licenseKey,
        licenseSecret: dbConfig.licenseSecret,
        source: "db",
      }
    : readEnvLicense();

  cachedConfig = { value, fetchedAt: now };
  return value;
}

export function maskWacomValue(value?: string | null, show = 8) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= show) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, show)}${"*".repeat(Math.max(0, trimmed.length - show - 2))}${trimmed.slice(-2)}`;
}

export async function fetchWacomLicenseFromApi(): Promise<WacomLicenseConfig | null> {
  const response = await fetch("/api/wacom/license", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossibile recuperare la licenza Wacom.");
  }

  const payload = (await response.json()) as {
    configured?: boolean;
    licenseKey?: string;
    licenseSecret?: string;
    source?: "db" | "env";
  };

  if (!payload.configured || !payload.licenseKey || !payload.licenseSecret) {
    return null;
  }

  return {
    licenseKey: payload.licenseKey,
    licenseSecret: payload.licenseSecret,
    source: payload.source ?? "db",
  };
}