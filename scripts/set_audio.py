#!/usr/bin/env python3
"""Remember where your mix lives (src/render-settings.json).
  audioFile   : absolute path of the mix (used by mux_audio.py)
  audioPublic : path relative to public/ if the mix is inside public/ (then the
                video plays it directly: sound in Studio, and renders include it),
                otherwise null (video renders silent and mux_audio.py adds it)."""
import json
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub = os.path.join(root, "public")
p = os.path.join(root, "src", "render-settings.json")
s = json.load(open(p, encoding="utf-8"))
audio = os.path.abspath(sys.argv[1])
if not os.path.exists(audio):
    raise SystemExit(f"[set_audio] not found: {audio}")
rel = os.path.relpath(audio, pub)
inside = not rel.startswith("..") and not os.path.isabs(rel)
s["audioFile"] = audio
s["audioPublic"] = rel.replace(os.sep, "/") if inside else None
feat_path = os.path.join(root, "src", "data", "audio_features.json")
if os.path.exists(feat_path):
    feat = json.load(open(feat_path, encoding="utf-8"))
    if "detectedOffset" in feat:
        old = s.get("audioStartOffsetSec", 0)
        s["audioStartOffsetSec"] = feat["detectedOffset"]
        note = "" if abs(old - feat["detectedOffset"]) < 1e-3 else f"  (was {old})"
        print(f"[set_audio] audioStartOffsetSec = {feat['detectedOffset']}{note}  ← detected from where the mix starts sounding")
json.dump(s, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"[set_audio] audioFile = {audio}")
print(f"[set_audio] " + (f"inside public/ -> played in the video (Studio has sound): {s['audioPublic']}" if inside
                         else "outside public/ -> video renders silent, audio is muxed in after rendering"))
