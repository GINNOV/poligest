#!/usr/bin/env node
/**
 * Update default ScanID metadata in app/src/lib/scanid-meta.ts.
 * Usage: node scripts/update-scanid-meta.mjs <version> [releaseNotes]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2]?.trim();
const notes = process.argv.slice(3).join(" ").trim();

if (!version) {
  console.error("Usage: node scripts/update-scanid-meta.mjs <version> [releaseNotes]");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(scriptDir, "..");
const repoRoot = path.join(appRoot, "..");
const metaFile = path.join(appRoot, "src/lib/scanid-meta.ts");
const infoPlistFile = path.join(repoRoot, "macos/Info.plist");
const downloadUrl = `https://github.com/GINNOV/poligest/releases/download/scanid-v${version}/ScanID-${version}.dmg`;

let src = fs.readFileSync(metaFile, "utf8");

src = src.replace(
  /process\.env\.SCANID_LATEST_VERSION \|\| "[^"]+"/,
  `process.env.SCANID_LATEST_VERSION || "${version}"`,
);
src = src.replace(
  /process\.env\.SCANID_DOWNLOAD_URL \|\|\s*\n?\s*"[^"]+"/,
  `process.env.SCANID_DOWNLOAD_URL ||\n    "${downloadUrl}"`,
);
src = src.replace(
  /process\.env\.SCANID_RELEASE_NOTES \|\|\s*\n?\s*"[^"]*"/,
  `process.env.SCANID_RELEASE_NOTES ||\n    ${JSON.stringify(notes)}`,
);

fs.writeFileSync(metaFile, src);

if (fs.existsSync(infoPlistFile)) {
  let plist = fs.readFileSync(infoPlistFile, "utf8");
  plist = plist.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${version}$2`,
  );
  fs.writeFileSync(infoPlistFile, plist);
}

console.log(`Updated ${path.relative(process.cwd(), metaFile)}`);
if (fs.existsSync(infoPlistFile)) {
  console.log(`Updated ${path.relative(process.cwd(), infoPlistFile)}`);
}
console.log(`  version:     ${version}`);
console.log(`  downloadUrl: ${downloadUrl}`);
console.log(`  notes:       ${notes || "(empty)"}`);