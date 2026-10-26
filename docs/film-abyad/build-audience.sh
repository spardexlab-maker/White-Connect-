#!/usr/bin/env bash
# Render a 2-minute film for one audience.  Usage: docs/film-abyad/build-audience.sh doctor|lab|pharmacy [out.mp4]
# Same pipeline as build.sh, with the audience's narration from audiences/<name>.json.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
NAME="$1"; OUT="${2:-$ROOT/marketing/abyad-$NAME.mp4}"
W="$(mktemp -d)"; cp "$HERE/film.html" "$W/"; cp "$HERE/audiences/$NAME.json" "$W/script.json"; cp -r "$HERE/assets" "$W/"; mkdir -p "$W/audio" "$W/fonts" "$(dirname "$OUT")"
cd "$W"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@500;700&display=swap" -o fonts/g.css
python3 "$HERE/prepare.py"
[ -n "${PREPARE_ONLY:-}" ] && { echo "prepared: $W"; exit 0; }
node "$ROOT/scripts/film-render.mjs" "$W" "$W/silent.mp4"
python3 "$ROOT/docs/film/mix.py"
ffmpeg -v error -y -i silent.mp4 -i mix.wav -c:v copy -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
