export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.1";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.1/ScanID-1.3.1.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Quits fully when the window is closed. Automatic update checks enabled by default.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}