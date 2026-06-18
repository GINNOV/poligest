export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.2.1";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.2.1/ScanID-1.2.1.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Fixes in-app update install (Install & Relaunch). Adds zoom on captured images.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}