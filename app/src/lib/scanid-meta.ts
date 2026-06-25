export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.8";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.8/ScanID-1.3.8.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Camera capture now uses a high-quality still photo before OCR, with stronger ID fixture coverage and capture reliability fixes.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
