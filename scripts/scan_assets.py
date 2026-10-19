#!/usr/bin/env python3
"""Lists files present in public/img, public/audio, public/fonts and records the
size + background colour of each image, so the camera can frame shots in
normalised coordinates and fill the letterbox with the image's own background."""
import json
import os
import struct
import sys

pub = sys.argv[1] if len(sys.argv) > 1 else "public"
out = sys.argv[2] if len(sys.argv) > 2 else "src/data/assets.json"


def ls(d, exts):
    p = os.path.join(pub, d)
    return sorted(f for f in os.listdir(p) if f.lower().endswith(exts)) if os.path.isdir(p) else []


def meta(path):
    try:
        from PIL import Image  # optional
        im = Image.open(path).convert("RGB")
        w, h = im.size
        px = im.load()
        pts = [(4, 4), (w - 5, 4), (4, h - 5), (w - 5, h - 5), (w // 2, 4), (w // 2, h - 5)]
        c = [sum(px[x, y][i] for x, y in pts) // len(pts) for i in range(3)]
        return {"w": w, "h": h, "bg": "#%02x%02x%02x" % tuple(c)}
    except ImportError:
        with open(path, "rb") as f:
            head = f.read(32)
        if head[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", head[16:24])
            return {"w": w, "h": h, "bg": "#270e49"}
        raise SystemExit(f"[scan_assets] install Pillow (pip install pillow) or use PNG for {path}")


img = ls("img", (".png", ".jpg", ".jpeg", ".webp"))
audio = ls("audio", (".wav", ".mp3", ".flac", ".m4a", ".aac"))
fonts = ls("fonts", (".ttf", ".otf", ".woff", ".woff2"))
img_meta = {f: meta(os.path.join(pub, "img", f)) for f in img}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump({"img": img, "imgMeta": img_meta, "audio": audio, "fonts": fonts}, f, indent=1)
for f_, m in img_meta.items():
    print(f"[scan_assets] image : {f_}  {m['w']}x{m['h']}  bg {m['bg']}")
if not img:
    print("[scan_assets] image : (none – put your illustration at public/img/pv.png)")
print(f"[scan_assets] audio : {', '.join(audio) or '(none – video will be silent)'}")
print(f"[scan_assets] fonts : {', '.join(fonts) or '(none – Google Fonts will be downloaded at render time)'}")
