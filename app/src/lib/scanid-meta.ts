export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.5";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.5/ScanID-1.3.5.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Fixes aggressive update prompts: silent checks no longer interrupt, Later is remembered, and checks run once per day.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}