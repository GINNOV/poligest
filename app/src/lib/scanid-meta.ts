export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.4";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.4/ScanID-1.3.4.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Editable scanned fields, prominent patient record link after sync, and sync progress in results panel.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}