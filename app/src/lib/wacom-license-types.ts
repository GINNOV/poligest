export const WACOM_CONFIG_ID = "default";

export type WacomLicenseConfig = {
  licenseKey: string;
  licenseSecret: string;
  source: "db" | "env";
};