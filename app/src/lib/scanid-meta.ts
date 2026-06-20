export type ScanIdMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getScanIdMeta(): ScanIdMeta {
  const version = process.env.SCANID_LATEST_VERSION || "1.3.0";
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.0/ScanID-1.3.0.dmg";
  const notes =
    process.env.SCANID_RELEASE_NOTES ||
    "Camera, Detection, and Developer settings. ESC cancels capture. Countdown sound. Auto zoom and expected-field overlays.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}