export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.3";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.3/ScanID-1.3.3.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Fixes in-app update install: strips Gatekeeper quarantine, checks for updates on every launch, and mounts DMG reliably.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}