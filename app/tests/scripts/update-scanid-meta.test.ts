import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const scriptPath = path.join(repoRoot, "app/scripts/update-scanid-meta.mjs");
const metaFile = path.join(repoRoot, "app/src/lib/scanid-meta.ts");
const infoPlistFile = path.join(repoRoot, "apps/macos/Info.plist");

let originalMeta = "";
let originalPlist = "";

beforeEach(() => {
  originalMeta = fs.readFileSync(metaFile, "utf8");
  originalPlist = fs.readFileSync(infoPlistFile, "utf8");
});

afterEach(() => {
  fs.writeFileSync(metaFile, originalMeta);
  fs.writeFileSync(infoPlistFile, originalPlist);
});

describe("update-scanid-meta.mjs", () => {
  it("updates version, download URL, release notes, and Info.plist", () => {
    execFileSync("node", [scriptPath, "9.8.7", "Test release notes"], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const updated = fs.readFileSync(metaFile, "utf8");
    expect(updated).toContain('process.env.SCANID_LATEST_VERSION || "9.8.7"');
    expect(updated).toContain(
      "https://github.com/GINNOV/poligest/releases/download/scanid-v9.8.7/ScanID-9.8.7.dmg",
    );
    expect(updated).toContain('process.env.SCANID_RELEASE_NOTES ||\n    "Test release notes"');

    const plist = fs.readFileSync(infoPlistFile, "utf8");
    expect(plist).toContain("<key>CFBundleShortVersionString</key>\n\t<string>9.8.7</string>");
  });
});
