#!/usr/bin/env node
/**
 * Update default QuickNotes metadata in app/src/lib/quicknotes-meta.ts.
 * Usage: node scripts/update-quicknotes-meta.mjs <version> [releaseNotes]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2]?.trim();
const notes = process.argv.slice(3).join(" ").trim();

if (!version) {
  console.error("Usage: node scripts/update-quicknotes-meta.mjs <version> [releaseNotes]");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(scriptDir, "..");
const repoRoot = path.join(appRoot, "..");
const metaFile = path.join(appRoot, "src/lib/quicknotes-meta.ts");
const projectFile = path.join(repoRoot, "apps/iOS/QuickNotes.xcodeproj/project.pbxproj");
const downloadUrl = `https://github.com/GINNOV/poligest/releases/download/quicknotes-v${version}/QuickNotes-${version}.dmg`;

let src = fs.readFileSync(metaFile, "utf8");

src = src.replace(
  /process\.env\.QUICKNOTES_LATEST_VERSION \|\| "[^"]+"/,
  `process.env.QUICKNOTES_LATEST_VERSION || "${version}"`,
);
src = src.replace(
  /process\.env\.QUICKNOTES_DOWNLOAD_URL \|\|\s*\n?\s*"[^"]+"/,
  `process.env.QUICKNOTES_DOWNLOAD_URL ||\n    "${downloadUrl}"`,
);
src = src.replace(
  /process\.env\.QUICKNOTES_RELEASE_NOTES \|\|\s*\n?\s*"[^"]*"/,
  `process.env.QUICKNOTES_RELEASE_NOTES ||\n    ${JSON.stringify(notes)}`,
);

fs.writeFileSync(metaFile, src);

if (fs.existsSync(projectFile)) {
  let project = fs.readFileSync(projectFile, "utf8");
  project = project.replace(
    /(<key>MARKETING_VERSION<\/key>\s*<string>)[^<]+(<\/string>)/g,
    `$1${version}$2`,
  );
  fs.writeFileSync(projectFile, project);
}

console.log(`Updated ${path.relative(process.cwd(), metaFile)}`);
if (fs.existsSync(projectFile)) {
  console.log(`Updated ${path.relative(process.cwd(), projectFile)}`);
}
console.log(`  version:     ${version}`);
console.log(`  downloadUrl: ${downloadUrl}`);
console.log(`  notes:       ${notes || "(empty)"}`);