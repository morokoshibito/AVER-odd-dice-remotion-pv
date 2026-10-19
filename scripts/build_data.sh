#!/usr/bin/env bash
# Regenerate src/data/ from your SVP, lyrics.txt and mix. Nothing is copied:
# your files stay where they are; the mix path is remembered in src/render-settings.json.
# usage: bash scripts/build_data.sh path/to/odddice.svp path/to/odddice.wav
set -euo pipefail
cd "$(dirname "$0")/.."
SVP="${1:?give the .svp path}"
MIX="${2:?give the mix .wav path}"
python3 scripts/extract_svp.py "$SVP" -o src/data/timing.json
python3 scripts/align_lyrics.py "$SVP" lyrics.txt -o src/data/lyrics.json
python3 scripts/analyze_audio.py "$MIX" -o src/data/audio_features.json --beats src/data/timing.json --svp "$SVP"
python3 scripts/set_audio.py "$MIX"
python3 scripts/scan_assets.py public src/data/assets.json
echo "[build_data] done."
