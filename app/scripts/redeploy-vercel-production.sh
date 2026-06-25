#!/bin/bash
# Redeploy the linked Vercel production app from the repository root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Error: vercel CLI not found."
  exit 1
fi

ARGS=(deploy --prod --yes)
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  ARGS+=(--token "$VERCEL_TOKEN")
fi

vercel "${ARGS[@]}"