export type QuickNotesMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getQuickNotesMeta(): QuickNotesMeta {
  const version = process.env.QUICKNOTES_LATEST_VERSION || "1.0";
  const downloadUrl =
    process.env.QUICKNOTES_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/quicknotes-v1.0/QuickNotes-1.0.dmg";
  const notes =
    process.env.QUICKNOTES_RELEASE_NOTES ||
    "Prima release macOS (Mac Catalyst) di Sorriso Mobile per gestire note e pagamenti dallo studio.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}