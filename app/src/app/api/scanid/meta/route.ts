import { NextResponse } from "next/server";

// Public (or lightly authenticated) metadata for the macOS ScanID companion app.
// The macOS app fetches this from its configured serverUrl to implement "check for updates".
// Configure via environment variables on the Sorriso deployment:
//   SCANID_LATEST_VERSION=1.2.0
//   SCANID_DOWNLOAD_URL=https://github.com/GINNOV/poligest/releases/download/scanid-v1.2.0/ScanID.app.zip
// Fallbacks allow the feature to work in development without extra config.

export async function GET() {
  const version = process.env.SCANID_LATEST_VERSION || "1.1.0";
  // Default points to the project's releases page; in production set a direct asset URL
  // (e.g. a GitHub release asset or a stable hosted .zip of the .app bundle).
  const downloadUrl =
    process.env.SCANID_DOWNLOAD_URL ||
    "https://github.com/GINNOV/poligest/releases/download/scanid-v1.1.0/ScanID-1.1.0.dmg";

  const notes = process.env.SCANID_RELEASE_NOTES || "";

  return NextResponse.json({
    version,
    downloadUrl,
    notes: notes || undefined,
  });
}
