export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.7";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.7/ScanID-1.3.7.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Uses Sentinel after auto-update deployment to remove quarantine from the installed app before relaunch.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
