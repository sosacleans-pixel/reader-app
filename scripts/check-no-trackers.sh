#!/usr/bin/env bash
# Fails (exit 1) if any deployed file references Google Analytics / Tag Manager / Google Fonts.
# Run from the repo root:  bash scripts/check-no-trackers.sh
# Scans everything GitHub Pages would serve (the whole repo except .git), including binaries' text.
set -euo pipefail
cd "$(dirname "$0")/.."
PATTERN='gtag|googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic'
# This script itself names the patterns, so it is the only file excluded.
hits=$(grep -rIlE --exclude-dir=.git --exclude=check-no-trackers.sh "$PATTERN" . || true)
if [ -n "$hits" ]; then
  echo "FAIL: tracker / Google Fonts references found in deployed files:"
  grep -rInoE --exclude-dir=.git --exclude=check-no-trackers.sh "$PATTERN" . | cut -c1-200
  exit 1
fi
# Also fail on any third-party origin loaded by HTML (script/link/img/iframe src or href to stylesheets).
bad=$(grep -rhoiE --exclude-dir=.git --include='*.html' '<(script|link|img|iframe)[^>]+(src|href)="https?://[^"]+' . \
      | grep -viE 'https://(app\.coachsalimheyaime\.com|olncfwohfpgpmygxjpcm\.supabase\.co)' \
      | grep -viE '<link[^>]+rel="canonical"' || true)
if [ -n "$bad" ]; then
  echo "FAIL: HTML loads a third-party resource:"; echo "$bad"; exit 1
fi
echo "OK: no gtag, googletagmanager, google-analytics, fonts.googleapis or fonts.gstatic; no third-party resources in HTML."
