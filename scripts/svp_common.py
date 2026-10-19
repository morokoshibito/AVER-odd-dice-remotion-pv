"""Shared helpers for reading a Synthesizer V Studio (.svp) project.

Time base
---------
All times written to src/data/*.json are in "audio seconds" measured from the
first sample of the *instrumental* track that lives inside the SVP (the "Inst"
track, which has a blickOffset). If you export your final mix from SynthV with
the project starting at 0, set AUDIO_START_OFFSET_SEC in src/config.ts instead
of touching these scripts.
"""
import json

BLICKS_PER_QUARTER = 705_600_000


def load_svp(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


class TempoMap:
    def __init__(self, svp):
        self.points = sorted(svp["time"]["tempo"], key=lambda p: p["position"])
        self.meters = sorted(svp["time"]["meter"], key=lambda m: m["index"])
        # cumulative seconds at each tempo point
        self._cum = []
        t = 0.0
        for i, p in enumerate(self.points):
            self._cum.append(t)
            if i + 1 < len(self.points):
                seg = self.points[i + 1]["position"] - p["position"]
                t += seg / BLICKS_PER_QUARTER * 60.0 / p["bpm"]

    def seconds(self, blick):
        """Project seconds at a blick position."""
        lo, hi = 0, len(self.points) - 1
        while lo < hi:  # last point with position <= blick
            mid = (lo + hi + 1) // 2
            if self.points[mid]["position"] <= blick:
                lo = mid
            else:
                hi = mid - 1
        p = self.points[lo]
        return self._cum[lo] + (blick - p["position"]) / BLICKS_PER_QUARTER * 60.0 / p["bpm"]

    def bpm_at(self, blick):
        cur = self.points[0]["bpm"]
        for p in self.points:
            if p["position"] <= blick:
                cur = p["bpm"]
            else:
                break
        return cur

    def bars(self, until_seconds):
        """Yield (bar_index, blick_position, numerator, denominator)."""
        by_index = {m["index"]: m for m in self.meters}
        cur = by_index.get(0, {"numerator": 4, "denominator": 4})
        pos, bar = 0, 0
        while True:
            if bar in by_index:
                cur = by_index[bar]
            yield bar, pos, cur["numerator"], cur["denominator"]
            pos += cur["numerator"] * BLICKS_PER_QUARTER * 4 // cur["denominator"]
            bar += 1
            if self.seconds(pos) > until_seconds:
                return


def inst_offset_seconds(svp, tempo):
    """Project-seconds where the instrumental audio starts (0 if none)."""
    for tr in svp["tracks"]:
        ref = tr["mainRef"]
        if ref.get("isInstrumental") and ref.get("audio") and tr.get("name", "").lower().startswith("inst"):
            return tempo.seconds(ref.get("blickOffset", 0)), ref["audio"].get("duration")
    for tr in svp["tracks"]:
        ref = tr["mainRef"]
        if ref.get("isInstrumental") and ref.get("audio"):
            return tempo.seconds(ref.get("blickOffset", 0)), ref["audio"].get("duration")
    return 0.0, None


def iter_notes(svp, track_names):
    """Yield (track_name, group_name, onset_blick, end_blick, lyric) for the
    given (non-instrumental) tracks, including every group reference."""
    lib = {g["uuid"]: g for g in svp.get("library", [])}
    for tr in svp["tracks"]:
        if tr.get("name") not in track_names:
            continue
        refs = [tr["mainRef"]] + list(tr.get("groups", []))
        for ref in refs:
            if ref.get("isInstrumental"):
                continue
            gid = ref.get("groupID")
            group = lib.get(gid) if gid in lib else (tr.get("mainGroup") if ref is tr["mainRef"] else None)
            if group is None:
                continue
            off = ref.get("blickOffset", 0)
            for n in group.get("notes", []):
                on = n["onset"] + off
                yield tr["name"], group.get("name", ""), on, on + n["duration"], n.get("lyrics", "")
