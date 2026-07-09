#!/bin/bash
# Sync QUICKNOTES_* production env vars on Vercel from app/src/lib/quicknotes-meta.ts defaults.
# Requires: vercel login (or VERCEL_TOKEN), project linked in app/.vercel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
META_FILE="$ROOT/src/lib/quicknotes-meta.ts"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Error: vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

if [[ -f "$ROOT/.vercel/project.json" ]]; then
  :
elif [[ -n "${VERCEL_ORG_ID:-}" && -n "${VERCEL_PROJECT_ID:-}" ]]; then
  export VERCEL_ORG_ID VERCEL_PROJECT_ID
else
  echo "Error: link Vercel (cd app && vercel link) or set VERCEL_ORG_ID and VERCEL_PROJECT_ID"
  exit 1
fi

VERSION=$(node -e '
const fs = require("fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const version = src.match(/QUICKNOTES_LATEST_VERSION \|\| "([^"]+)"/)?.[1];
if (!version) process.exit(1);
process.stdout.write(version);
' "$META_FILE")

DOWNLOAD_URL=$(node -e '
const fs = require("fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const downloadUrl = src.match(/QUICKNOTES_DOWNLOAD_URL \|\|\s*\n?\s*"([^"]+)"/)?.[1]
  ?? src.match(/QUICKNOTES_DOWNLOAD_URL \|\| "([^"]+)"/)?.[1];
if (!downloadUrl) process.exit(1);
process.stdout.write(downloadUrl);
' "$META_FILE")

NOTES=$(node -e '
const fs = require("fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const notes = src.match(/QUICKNOTES_RELEASE_NOTES \|\|\s*\n?\s*"([^"]+)"/)?.[1]
  ?? src.match(/QUICKNOTES_RELEASE_NOTES \|\| "([^"]+)"/)?.[1]
  ?? "";
process.stdout.write(notes);
' "$META_FILE")

if [[ -z "$VERSION" || -z "$DOWNLOAD_URL" ]]; then
  echo "Error: could not parse version/download URL from $META_FILE"
  exit 1
fi

echo "==> Syncing QuickNotes metadata to Vercel production"
echo "    version:      $VERSION"
echo "    downloadUrl:  $DOWNLOAD_URL"
echo "    notes:        $NOTES"

cd "$ROOT"

upsert_env() {
  local name="$1"
  local value="$2"
  vercel env rm "$name" production --yes 2>/dev/null || true
  printf '%s' "$value" | vercel env add "$name" production
}

upsert_env QUICKNOTES_LATEST_VERSION "$VERSION"
upsert_env QUICKNOTES_DOWNLOAD_URL "$DOWNLOAD_URL"
upsert_env QUICKNOTES_RELEASE_NOTES "$NOTES"

echo "==> Done. Redeploy production to apply:"
echo "    cd app && vercel deploy --prod"