import type { WacomLicenseConfig } from "@/lib/wacom-license-types";

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