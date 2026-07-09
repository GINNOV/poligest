export type QuickNotesMeta = {
  version: string;
  downloadUrl: string;
  notes?: string;
};

export function getQuickNotesMeta(): QuickNotesMeta {
  const version = process.env.QUICKNOTES_LATEST_VERSION || "1.0.2";
  const downloadUrl =
    process.env.QUICKNOTES_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/quicknotes-v1.0.2/QuickNotes-1.0.2.dmg";
  const notes =
    process.env.QUICKNOTES_RELEASE_NOTES ||
    "Corregge il crash dopo Touch ID su Mac: mantiene il contesto di autenticazione, evita il blocco durante la richiesta biometrica e disabilita Watch/CloudKit su macOS Catalyst.";

  return {
    version,
    downloadUrl,
    notes: notes || undefined,
  };
}