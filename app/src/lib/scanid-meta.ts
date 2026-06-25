export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.9";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.9/ScanID-1.3.9.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "In-app updates use Sentinel to clear Gatekeeper quarantine. Auto-download can install without an extra click. Camera permission is requested once. Upload Image mode shows import instructions on the side panel.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}
