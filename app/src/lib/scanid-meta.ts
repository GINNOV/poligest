export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.2";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.2/ScanID-1.3.2.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Prominent iPhone camera instructions, improved camera picker, and Continuity Camera orientation fix.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}