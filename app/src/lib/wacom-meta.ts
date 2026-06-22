import fs from "node:fs";
import path from "node:path";
import { getWacomLicenseConfig, maskWacomValue } from "@/lib/wacom-config";

export type WacomMeta = {
  licenseConfigured: boolean;
  licenseKeyPreview: string | null;
  licenseSource: "db" | "env" | null;
  sdkFilesPresent: boolean;
  sdkFiles: string[];
};

export async function getWacomMeta(): Promise<WacomMeta> {
  const license = await getWacomLicenseConfig();
  const licenseConfigured = Boolean(license);

  const wacomDir = path.join(process.cwd(), "public", "wacom");
  const expectedFiles = ["signature-sdk.js", "signature-sdk.wasm", "signature_sdk.js", "signature_sdk.wasm"];
  const sdkFiles = expectedFiles.filter((file) => fs.existsSync(path.join(wacomDir, file)));
  const sdkFilesPresent =
    sdkFiles.includes("signature-sdk.js") && sdkFiles.includes("signature-sdk.wasm");

  return {
    licenseConfigured,
    licenseKeyPreview: license ? maskWacomValue(license.licenseKey) : null,
    licenseSource: license?.source ?? null,
    sdkFilesPresent,
    sdkFiles,
  };
}