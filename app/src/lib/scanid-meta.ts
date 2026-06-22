export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.6";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.6/ScanID-1.3.6.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Fixes auto-update installation so downloaded updates are not left quarantined and the installed app signature is preserved.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
