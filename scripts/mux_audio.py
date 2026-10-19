#!/usr/bin/env python3
"""Mux your mix (from wherever it lives — path in src/render-settings.json
"audioFile", relative to the project folder or absolute) into a rendered video.

usage: python scripts/mux_audio.py silent.mp4 final.mp4 [start_frame]
start_frame: first frame of the rendered range (0 for the full video)
"""
import json
import os
import subprocess
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = json.load(open(os.path.join(root, "src", "render-settings.json"), encoding="utf-8"))
audio = s["audioFile"]
if not os.path.isabs(audio):
    audio = os.path.join(root, audio)
if not os.path.exists(audio):
    raise SystemExit(f"[mux] audio not found: {audio}  (set audioFile in src/render-settings.json)")

silent, final = sys.argv[1], sys.argv[2]
if s.get("audioPublic"):
    # the mix is inside public/ and was already rendered into the video
    os.replace(silent, final)
    print(f"[mux] {final}  (audio already included from public/{s['audioPublic']})")
    raise SystemExit(0)
start_frame = int(sys.argv[3]) if len(sys.argv) > 3 else 0
start = start_frame / s["fps"]
subprocess.run([
    "ffmpeg", "-v", "error", "-y", "-i", silent, "-ss", f"{start:.4f}", "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", final,
], check=True)
os.remove(silent)
print(f"[mux] {final}  (audio: {audio}, from {start:.3f}s)")
