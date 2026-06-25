export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.10";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.10/ScanID-1.3.10.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Optional email and phone fields when creating a patient in Sorriso. Leave them blank to skip — scanned ID fields work as before.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
