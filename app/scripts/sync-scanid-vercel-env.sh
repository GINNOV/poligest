#!/bin/bash
# Sync SCANID_* production env vars on Vercel from app/src/lib/scanid-meta.ts defaults.
# Requires: vercel login (or VERCEL_TOKEN), project linked in app/.vercel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
META_FILE="$ROOT/src/lib/scanid-meta.ts"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Error: vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ROOT/.vercel/project.json" ]]; then
  echo "Error: app is not linked to Vercel. Run: cd app && vercel link"
  exit 1
fi

IFS=$'\t' read -r VERSION DOWNLOAD_URL NOTES < <(node -e '
const fs = require("fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const version = src.match(/SCANID_LATEST_VERSION \|\| "([^"]+)"/)?.[1];
const downloadUrl = src.match(/SCANID_DOWNLOAD_URL \|\|\s*\n?\s*"([^"]+)"/)?.[1]
  ?? src.match(/SCANID_DOWNLOAD_URL \|\| "([^"]+)"/)?.[1];
const notes = src.match(/SCANID_RELEASE_NOTES \|\|\s*\n?\s*"([^"]+)"/)?.[1]
  ?? src.match(/SCANID_RELEASE_NOTES \|\| "([^"]+)"/)?.[1]
  ?? "";
if (!version || !downloadUrl) process.exit(1);
process.stdout.write(`${version}\t${downloadUrl}\t${notes}`);
' "$META_FILE")

if [[ -z "$VERSION" || -z "$DOWNLOAD_URL" ]]; then
  echo "Error: could not parse version/download URL from $META_FILE"
  exit 1
fi

echo "==> Syncing ScanID metadata to Vercel production"
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

upsert_env SCANID_LATEST_VERSION "$VERSION"
upsert_env SCANID_DOWNLOAD_URL "$DOWNLOAD_URL"
upsert_env SCANID_RELEASE_NOTES "$NOTES"

echo "==> Done. Redeploy production to apply:"
echo "    cd app && vercel deploy --prod"