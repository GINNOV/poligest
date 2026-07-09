import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const scriptPath = path.join(repoRoot, "app/scripts/update-quicknotes-meta.mjs");
const metaFile = path.join(repoRoot, "app/src/lib/quicknotes-meta.ts");
const projectFile = path.join(repoRoot, "apps/iOS/QuickNotes.xcodeproj/project.pbxproj");

let originalMeta = "";
let originalProject = "";

beforeEach(() => {
  originalMeta = fs.readFileSync(metaFile, "utf8");
  originalProject = fs.readFileSync(projectFile, "utf8");
});

afterEach(() => {
  fs.writeFileSync(metaFile, originalMeta);
  fs.writeFileSync(projectFile, originalProject);
});

describe("update-quicknotes-meta.mjs", () => {
  it("updates version, download URL, release notes, and Xcode project", () => {
    execFileSync("node", [scriptPath, "2.4.6", "Test release notes"], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const updated = fs.readFileSync(metaFile, "utf8");
    expect(updated).toContain('process.env.QUICKNOTES_LATEST_VERSION || "2.4.6"');
    expect(updated).toContain(
      "https://github.com/GINNOV/poligest/releases/download/quicknotes-v2.4.6/QuickNotes-2.4.6.dmg",
    );
    expect(updated).toContain('process.env.QUICKNOTES_RELEASE_NOTES ||\n    "Test release notes"');

    const project = fs.readFileSync(projectFile, "utf8");
    expect(project).toContain("<key>MARKETING_VERSION</key>\n\t\t\t\t<string>2.4.6</string>");
  });
});