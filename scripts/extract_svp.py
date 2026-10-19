#!/usr/bin/env python3
"""SVP -> src/data/timing.json

Writes the musical skeleton the video is driven by:
  - duration       : seconds (length of the Inst audio inside the SVP)
  - beats          : every beat {t, bar, beat, num, bpm, down}
  - bars           : every bar  {t, bar, num, den, bpm}
  - markers        : tempo / meter change points (handy for checking direction.ts)

No lyric text is written here (lyrics come from align_lyrics.py).

usage: python3 scripts/extract_svp.py path/to/project.svp [-o src/data/timing.json]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svp_common import BLICKS_PER_QUARTER, TempoMap, inst_offset_seconds, load_svp  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svp")
    ap.add_argument("-o", "--out", default="src/data/timing.json")
    ap.add_argument("--duration", type=float, default=None, help="override total seconds")
    a = ap.parse_args()

    svp = load_svp(a.svp)
    tempo = TempoMap(svp)
    off, inst_dur = inst_offset_seconds(svp, tempo)
    duration = a.duration or inst_dur or 240.0

    beats, bars, markers = [], [], []
    prev_key = None
    for bar, pos, num, den in tempo.bars(off + duration + 2):
        t_bar = tempo.seconds(pos) - off
        bpm = tempo.bpm_at(pos)
        bars.append({"t": round(t_bar, 4), "bar": bar, "num": num, "den": den, "bpm": round(bpm, 2)})
        key = (num, den, round(bpm))
        if key != prev_key:
            markers.append({"t": round(t_bar, 3), "bar": bar, "meter": f"{num}/{den}", "bpm": round(bpm, 1)})
            prev_key = key
        step = BLICKS_PER_QUARTER * 4 // den
        for b in range(num):
            p = pos + b * step
            t = tempo.seconds(p) - off
            if -1 <= t <= duration + 1:
                beats.append({
                    "t": round(t, 4), "bar": bar, "beat": b, "num": num,
                    "bpm": round(tempo.bpm_at(p), 2), "down": b == 0,
                })

    out = {
        "duration": round(duration, 4),
        "instOffsetProjectSec": round(off, 4),
        "beats": beats,
        "bars": bars,
        "markers": markers,
    }
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"[extract_svp] duration={duration:.2f}s  inst offset={off:.3f}s  beats={len(beats)}  bars={len(bars)}")
    for m in markers:
        print(f"   {m['t']:8.2f}s  bar {m['bar']:3d}  {m['meter']:>5}  ♩={m['bpm']}")


if __name__ == "__main__":
    main()
