export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.11";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.11/ScanID-1.3.11.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Fixes automatic update notifications: launching the app now shows the update dialog when a newer version is available (previously suppressed after the first check).";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
