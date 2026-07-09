export type QuickNotesMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getQuickNotesMeta(): QuickNotesMeta {
  const version = process.env.QUICKNOTES_LATEST_VERSION || "1.0.1";
  const downloadUrl =
    process.env.QUICKNOTES_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/quicknotes-v1.0.1/QuickNotes-1.0.1.dmg";
  const notes =
    process.env.QUICKNOTES_RELEASE_NOTES ||
    "Build ad-hoc firmato per installazione su Mac client. Al primo avvio: tasto destro su QuickNotes.app → Apri. Richiede Mac Apple Silicon (M1+) con macOS 13+.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}