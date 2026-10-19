#!/usr/bin/env python3
"""mix audio -> src/data/audio_features.json

Pre-computes loudness / bass / mid / high envelopes at a fixed rate so the
Remotion render never has to decode audio in the browser (faster, deterministic).

requires: ffmpeg on PATH, numpy
usage: python3 scripts/analyze_audio.py public/audio/mix.wav [-o src/data/audio_features.json] [--rate 60]
"""
import argparse
import json
import os
import shutil
import subprocess

import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("-o", "--out", default="src/data/audio_features.json")
    ap.add_argument("--rate", type=int, default=60, help="feature frames per second")
    ap.add_argument("--svp", default=None, help="the .svp: its instrumental is measured as the reference start")
    ap.add_argument("--beats", default=None,
                    help="src/data/timing.json: detect whether the mix starts at the SVP instrumental (offset 0) "
                         "or at the SVP project start (offset = inst offset)")
    a = ap.parse_args()

    path = os.path.abspath(a.audio)
    if not os.path.isfile(path):
        folder = os.path.dirname(path)
        found = []
        if os.path.isdir(folder):
            found = [f for f in os.listdir(folder) if f.lower().endswith((".wav", ".flac", ".mp3", ".m4a", ".aac"))]
        hint = f"audio files in {folder}: {', '.join(found)}" if found else f"no audio files in {folder}"
        raise SystemExit(f"[analyze_audio] file not found: {path}\n[analyze_audio] {hint}\n"
                         "[analyze_audio] (Windows hides extensions: the file may really be named e.g. odddice.wav.wav)")
    if shutil.which("ffmpeg") is None:
        raise SystemExit("[analyze_audio] ffmpeg is not on PATH – install it or add its bin folder to PATH")

    sr = 22050
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        err = proc.stderr.decode("utf-8", errors="replace").strip()[-800:]
        raise SystemExit(f"[analyze_audio] ffmpeg could not decode {path} (exit {proc.returncode}):\n{err}")
    raw = proc.stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = sr // a.rate
    win = 2048
    pad = np.pad(x, (win // 2, win // 2))
    n = len(x) // hop
    window = np.hanning(win).astype(np.float32)
    freqs = np.fft.rfftfreq(win, 1 / sr)
    bands = {"bass": (20, 160), "mid": (160, 2000), "high": (2000, 10000)}
    masks = {k: (freqs >= lo) & (freqs < hi) for k, (lo, hi) in bands.items()}

    feats = {k: np.zeros(n, dtype=np.float32) for k in ["rms", *bands]}
    flux = np.zeros(n, dtype=np.float32)
    prev = None
    for i in range(n):
        seg = pad[i * hop: i * hop + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        feats["rms"][i] = np.sqrt(np.mean(seg ** 2))
        mag = np.abs(np.fft.rfft(seg * window))
        for k, m in masks.items():
            feats[k][i] = mag[m].mean()
        lm = np.log1p(mag)
        if prev is not None:
            flux[i] = np.maximum(0, lm - prev).sum()
        prev = lm

    out = {"rate": a.rate, "duration": len(x) / sr}
    for k, v in feats.items():
        # log-compress and normalise to 0..1 using robust percentiles
        v = np.log1p(v * 50)
        lo, hi = np.percentile(v, 2), np.percentile(v, 99.5)
        v = np.clip((v - lo) / max(1e-6, hi - lo), 0, 1)
        out[k] = [round(float(t), 3) for t in v]
    if a.beats and os.path.exists(a.beats):
        # Where does the mix start relative to the SVP instrumental?
        # A mix exported from SynthV from the project start carries the instrumental's
        # offset as leading silence; a mix built in a DAW on the instrumental does not.
        tm = json.load(open(a.beats, encoding="utf-8"))
        inst = float(tm.get("instOffsetProjectSec", 0))
        thr = 10 ** (-50 / 20)  # -50 dBFS

        def first_sound(samples):
            loud = np.flatnonzero(np.abs(samples) > thr)
            return float(loud[0] / sr) if len(loud) else 0.0

        first = first_sound(x)
        # the instrumental's own leading silence (it was separated from the release, which starts at 0.865 s)
        lead, lead_src = 0.865, "measured on the original release"
        if a.svp and os.path.exists(a.svp):
            try:
                svp = json.load(open(a.svp, encoding="utf-8-sig"))
                for tr in svp["tracks"]:
                    au = tr["mainRef"].get("audio") or {}
                    fn = au.get("filename")
                    if tr["mainRef"].get("isInstrumental") and fn and tr.get("name", "").lower().startswith("inst"):
                        base = os.path.dirname(os.path.abspath(a.svp))
                        for cand in (os.path.join(base, fn), os.path.join(base, os.path.basename(fn))):
                            if os.path.isfile(cand):
                                pr = subprocess.run(["ffmpeg", "-v", "error", "-t", "8", "-i", cand, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True)
                                if pr.returncode == 0 and pr.stdout:
                                    lead, lead_src = first_sound(np.frombuffer(pr.stdout, dtype=np.float32)), f"measured on {os.path.basename(cand)}"
                                break
            except Exception as e:  # noqa: BLE001
                print(f"[analyze_audio] (could not read the instrumental from the SVP: {e})")
        extra = first - lead
        if abs(extra) < 0.12:
            det = 0.0
        elif abs(extra - inst) < 0.12:
            det = inst
        else:
            det = None
        out["offsetCheck"] = {"firstSoundSec": round(first, 3), "instLeadSec": round(lead, 3), "inst": inst}
        print(f"[analyze_audio] mix starts sounding at {first:.3f}s; instrumental at {lead:.3f}s ({lead_src}); SVP inst offset {inst:.3f}s")
        if det is None:
            print("[analyze_audio] could not tell where the mix starts – keeping audioStartOffsetSec as it is; check by ear")
        else:
            out["detectedOffset"] = round(det, 3)
            where = "the SVP instrumental → offset 0" if det == 0 else f"the SVP project start → offset {inst:.3f}"
            print(f"[analyze_audio] the mix starts at {where}")
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"[analyze_audio] {n} frames @ {a.rate}/s, {out['duration']:.2f}s")


if __name__ == "__main__":
    main()
