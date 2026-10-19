#!/usr/bin/env bash
# Render helpers. Run from anywhere; output goes to out/.
#
#   bash scripts/render.sh full                 # whole MV, final quality  -> out/odddice_mv.mp4
#   bash scripts/render.sh preview              # whole MV at half size, fast -> out/preview.mp4
#   bash scripts/render.sh range 51 95          # seconds 51–95 at half size  -> out/range_51-95.mp4
#   bash scripts/render.sh still 120.5          # one PNG at 120.5 s          -> out/still_120.5.png
#
# Extra flags are passed to Remotion, e.g.  bash scripts/render.sh full --concurrency=6
# If the outro is black: add --gl=swangle  (CPU WebGL, slower but always works)
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-preview}"; shift || true

FPS=$(python3 -c "import json;print(json.load(open('src/render-settings.json'))['fps'])")
OFF=$(python3 -c "import json;print(json.load(open('src/render-settings.json'))['audioStartOffsetSec'])")
frame() { python3 -c "print(max(0,round(($1+$OFF)*$FPS)))"; }
mkdir -p out

case "$mode" in
  full)
    npx remotion render MV out/_silent.mp4 "$@"
    python3 scripts/mux_audio.py out/_silent.mp4 out/odddice_mv.mp4 0 ;;
  preview)
    npx remotion render MV out/_silent.mp4 --scale=0.5 --crf=26 "$@"
    python3 scripts/mux_audio.py out/_silent.mp4 out/preview.mp4 0 ;;
  range)
    a="${1:?start sec}"; b="${2:?end sec}"; shift 2
    fa=$(frame "$a"); fb=$(frame "$b")
    npx remotion render MV out/_silent.mp4 --frames="$fa-$fb" --scale=0.5 --crf=24 "$@"
    python3 scripts/mux_audio.py out/_silent.mp4 "out/range_${a}-${b}.mp4" "$fa" ;;
  still)
    s="${1:?seconds}"; shift
    npx remotion still MV "out/still_${s}.png" --frame="$(frame "$s")" "$@" ;;
  *)
    echo "unknown mode: $mode"; exit 1 ;;
esac
