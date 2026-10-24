#!/usr/bin/env bash
# Re-render the 2-minute marketing film.  Usage: docs/film/build.sh [brand name] [out.mp4]
# Needs: node + playwright (repo), ffmpeg, python3 with edge-tts (pip install edge-tts).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
BRAND="${1:-منصة الرعاية}"; OUT="${2:-$ROOT/marketing/platform-film.mp4}"
W="$(mktemp -d)"; cp "$HERE/film.html" "$HERE/script.json" "$W/"; mkdir -p "$W/audio" "$W/fonts" "$(dirname "$OUT")"
cd "$W"
# fonts (Google Fonts, OFL) kept local so the render needs no network
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Alexandria:wght@500;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" -o fonts/g.css
python3 "$HERE/prepare.py" "$BRAND"
node "$ROOT/scripts/film-render.mjs" "$W" "$W/silent.mp4"
python3 "$HERE/mix.py"
ffmpeg -v error -y -i silent.mp4 -i mix.wav -c:v copy -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
