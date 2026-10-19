#!/usr/bin/env python3
"""lyrics.txt + SVP notes -> src/data/lyrics.json   (per-glyph timing)

lyrics.txt format (exactly the format you already write):
  - one lyric line per text line, blank lines ignored
  - ruby:     漢字(かな)          e.g.  比(くら)べる   -> 比 with ruby くら
  - whisper:  ( ... ) NOT directly after a kanji, e.g.  取(と)り零(こぼ)す (1, 2, 3, 4, 5)
              -> styled as a whisper phrase (Vox 2 track in the SVP)
  - spaces split a line into phrases (each phrase animates on its own)
  - full-width （）and　are accepted too

How timing works
  The kana reading of the text is aligned (Needleman-Wunsch) against the kana
  stream of the lead-vocal notes in the SVP (tracks given by --tracks), so every
  glyph gets the onset of the note that sings it. Mismatches (e.g. は sung as わ,
  っ written as "cl") are tolerated; unmatched glyphs are interpolated.

Fine-tuning: lyrics.overrides.json  {"L13P0": {"shift": -0.05}, "L30P1": {"start": 176.4}}
  key = L<line>P<phrase> (1-based line, 0-based phrase). shift moves the whole phrase.

usage: python3 scripts/align_lyrics.py project.svp lyrics.txt [-o src/data/lyrics.json]
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svp_common import TempoMap, inst_offset_seconds, iter_notes, load_svp  # noqa: E402

KANJI_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿々〆ヶ]")
KANA_RE = re.compile(r"[ぁ-ゖァ-ヺ]")
DIGIT_READ = {"0": "ぜろ", "1": "いち", "2": "に", "3": "さん", "4": "し", "5": "ご",
              "6": "ろく", "7": "なな", "8": "はち", "9": "きゅう"}
SIMILAR = [set("はわ"), set("おを"), set("ずづ"), set("じぢ"), set("えへ"), set("しじ"), set("てで"), set("かが")]


def to_hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def norm_reading(s):
    s = to_hira(s)
    s = s.replace("を", "お").replace("づ", "ず").replace("ぢ", "じ")
    return "".join(c for c in s if KANA_RE.match(c) and c not in "っー")


# ---------------------------------------------------------------- parse text
def parse_line(line):
    """-> list of phrases; phrase = {"whisper": bool, "tokens": [{"s","r","read"}]}"""
    line = line.replace("（", "(").replace("）", ")").replace("　", " ").strip()
    phrases, cur, whisper = [], [], False
    i = 0

    def flush():
        nonlocal cur
        if cur:
            phrases.append({"whisper": whisper, "tokens": cur})
        cur = []

    while i < len(line):
        c = line[i]
        if c == "(":
            prev = cur[-1]["s"][-1] if cur and cur[-1]["s"] else ""
            if prev and KANJI_RE.match(prev):
                # ruby: attach to trailing kanji run of the previous tokens
                j = line.index(")", i)
                ruby = line[i + 1:j]
                run = []
                while cur and len(cur[-1]["s"]) == 1 and KANJI_RE.match(cur[-1]["s"]) and cur[-1]["r"] is None:
                    run.insert(0, cur.pop()["s"])
                surface = "".join(run)
                cur.append({"s": surface, "r": ruby, "read": norm_reading(ruby)})
                i = j + 1
                continue
            flush()
            whisper = True
            i += 1
            continue
        if c == ")":
            flush()
            whisper = False
            i += 1
            continue
        if c == " ":
            flush()
            i += 1
            continue
        read = DIGIT_READ.get(c, norm_reading(c))
        cur.append({"s": c, "r": None, "read": read})
        i += 1
    flush()
    # drop phrases that are only punctuation
    return [p for p in phrases if any(t["s"].strip(",、，") for t in p["tokens"])]


# ---------------------------------------------------------------- svp stream
def svp_stream(svp, tracks):
    tempo = TempoMap(svp)
    off, _ = inst_offset_seconds(svp, tempo)
    notes = sorted(iter_notes(svp, tracks), key=lambda n: (n[2], n[0]))
    chars, t0s, t1s, raw = [], [], [], []
    for _tr, _g, on, end, lyr in notes:
        s, e = tempo.seconds(on) - off, tempo.seconds(end) - off
        lyr = (lyr or "").strip()
        if lyr.startswith("-") or lyr in ("+", "ー"):
            if t1s:
                t1s[-1] = max(t1s[-1], e)
            continue
        k = norm_reading(lyr)
        if not k:
            continue
        step = (e - s) / len(k)
        for idx, ch in enumerate(k):
            chars.append(ch)
            t0s.append(s + idx * step)
            t1s.append(s + (idx + 1) * step)
            raw.append(lyr)
    return chars, t0s, t1s, raw


# ---------------------------------------------------------------- alignment
def score(a, b):
    if a == b:
        return 3
    for grp in SIMILAR:
        if a in grp and b in grp:
            return 1
    return -2


def align(a, b, gap=-1):
    """Needleman-Wunsch; returns list mapping index in a -> index in b or None."""
    n, m = len(a), len(b)
    import array
    H = [array.array("i", [0]) * (m + 1) for _ in range(n + 1)]
    P = [bytearray(m + 1) for _ in range(n + 1)]  # 1 diag, 2 up, 3 left
    for i in range(1, n + 1):
        H[i][0] = i * gap
        P[i][0] = 2
    for j in range(1, m + 1):
        H[0][j] = 0          # free leading gaps in b (intro breaths etc.)
        P[0][j] = 3
    for i in range(1, n + 1):
        ai, Hi, Hp, Pi = a[i - 1], H[i], H[i - 1], P[i]
        for j in range(1, m + 1):
            d = Hp[j - 1] + score(ai, b[j - 1])
            u = Hp[j] + gap
            left_gap = 0 if i == n else gap  # free trailing gaps in b
            l = Hi[j - 1] + left_gap
            if d >= u and d >= l:
                Hi[j], Pi[j] = d, 1
            elif u >= l:
                Hi[j], Pi[j] = u, 2
            else:
                Hi[j], Pi[j] = l, 3
    res = [None] * n
    i, j = n, m
    while i > 0 and j >= 0:
        p = P[i][j]
        if p == 1:
            if a[i - 1] == b[j - 1] or score(a[i - 1], b[j - 1]) > 0:
                res[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif p == 2:
            i -= 1
        else:
            j -= 1
    return res


def assign_times(mapping, b0, b1):
    """Times for every reading kana.
    1. matched kana take their note's time
    2. a run of unmatched kana is laid onto the *unmatched* notes lying between its
       matched neighbours (the SVP often spells by sound: 言う → ゆ, ず → つ, で → て),
       in order and proportionally — never stretched across the whole gap
    3. only kana with no free note at all are interpolated
    returns (times, source) where source is 'match' | 'gap' | 'interp'"""
    n = len(mapping)
    used = {j for j in mapping if j is not None}
    out = [None] * n
    src = ['interp'] * n
    for k, j in enumerate(mapping):
        if j is not None:
            out[k] = (b0[j], b1[j])
            src[k] = 'match'
    k = 0
    while k < n:
        if mapping[k] is not None:
            k += 1
            continue
        s = k
        while k < n and mapping[k] is None:
            k += 1
        e = k
        jp = next((mapping[x] for x in range(s - 1, -1, -1) if mapping[x] is not None), None)
        jn = next((mapping[x] for x in range(e, n) if mapping[x] is not None), None)
        lo = (b1[jp] - 0.01) if jp is not None else ((b0[jn] - 2.0) if jn is not None else -1e9)
        hi = b0[jn] if jn is not None else ((b1[jp] + 2.0) if jp is not None else 1e9)
        j_from = (jp + 1) if jp is not None else 0
        j_to = jn if jn is not None else len(b0)
        free = [j for j in range(j_from, j_to) if j not in used and lo <= b0[j] <= hi]
        if not free:
            continue
        m = e - s
        for q in range(m):
            # more kana than free notes: kana sharing a note are sung on that note's onset
            # (言う on the single note ゆ → 言 and う appear together)
            fi = min(len(free) - 1, int(q * len(free) / m))
            j = free[fi]
            t0 = b0[j]
            out[s + q] = (t0, max(t0 + 0.05, b1[j]))
            src[s + q] = 'gap'
    return interpolate(out), src


def interpolate(times):
    """Fill None entries (pairs of (t0,t1)) linearly between known neighbours."""
    n = len(times)
    known = [k for k in range(n) if times[k] is not None]
    if not known:
        raise SystemExit("[align] nothing matched – check --tracks names and lyrics.txt")
    out = list(times)
    for k in range(n):
        if out[k] is not None:
            continue
        prev = max((x for x in known if x < k), default=None)
        nxt = min((x for x in known if x > k), default=None)
        if prev is None:
            t = times[nxt][0] - 0.12 * (nxt - k)
        elif nxt is None:
            t = times[prev][1] + 0.12 * (k - prev)
        else:
            a0, b0 = times[prev][1], times[nxt][0]
            t = a0 + (b0 - a0) * (k - prev) / (nxt - prev)
        out[k] = (t, t + 0.12)
    return out


def read_text(path):
    """Read a text file saved as UTF-8 (with or without BOM), UTF-16, Shift-JIS or GBK."""
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-16", "cp932", "gbk"):
        try:
            txt = raw.decode(enc)
            if enc == "utf-16" and not raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
                continue
            if enc != "utf-8-sig":
                print(f"[align] note: {path} is not UTF-8, read it as {enc}")
            return txt.splitlines()
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"[align] cannot decode {path}; save it as UTF-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svp")
    ap.add_argument("lyrics")
    ap.add_argument("-o", "--out", default="src/data/lyrics.json")
    ap.add_argument("--tracks", default="Vox,Vox 2",
                    help="comma separated lead-vocal track names in the SVP (whispers included)")
    ap.add_argument("--translation", default="translation.txt")
    ap.add_argument("--overrides", default="lyrics.overrides.json")
    a = ap.parse_args()

    svp = load_svp(a.svp)
    vocal_tracks = [t.get("name", "") for t in svp["tracks"] if not t["mainRef"].get("isInstrumental")]
    tracks = [t.strip() for t in a.tracks.split(",") if t.strip() in vocal_tracks]
    if not tracks:
        # track names differ from the default: use every vocal track except backing/chorus ones
        tracks = [n for n in vocal_tracks if not n.lower().startswith(("back", "chorus", "harm"))] or vocal_tracks
        print(f"[align] tracks '{a.tracks}' not found; using {tracks}")
    b_chars, b0, b1, b_raw = svp_stream(svp, tracks)
    print(f"[align] SVP vocal tracks: {vocal_tracks}  -> using {tracks}: {len(b_chars)} sung kana")

    raw_lines = [ln for ln in read_text(a.lyrics) if ln.strip() and not ln.lstrip().startswith("#")]
    print(f"[align] {a.lyrics}: {len(raw_lines)} lyric lines")
    if not raw_lines:
        raise SystemExit(f"[align] {a.lyrics} has no lyric lines – paste your 30 lines below the # comments and SAVE the file")
    if not b_chars:
        raise SystemExit("[align] no sung notes found in the SVP tracks above – is this the right .svp?")
    trans = []
    if os.path.exists(a.translation):
        trans = [ln.strip() for ln in read_text(a.translation) if ln.strip() and not ln.lstrip().startswith("#")]

    # flatten reading chars with back-pointers to tokens
    lines = [parse_line(ln) for ln in raw_lines]
    a_chars, owner = [], []
    for li, phrases in enumerate(lines):
        for pi, ph in enumerate(phrases):
            for ti, tok in enumerate(ph["tokens"]):
                for ch in tok["read"]:
                    a_chars.append(ch)
                    owner.append((li, pi, ti))

    print(f"[align] lyric kana to match: {len(a_chars)}")
    if not a_chars:
        raise SystemExit("[align] no kana found in lyrics.txt – are the readings written as 漢字(かな)?")
    mapping = align(a_chars, b_chars)
    matched = sum(1 for j in mapping if j is not None)
    times, source = assign_times(mapping, b0, b1)

    tok_times = {}
    tok_src = {}
    for k, own in enumerate(owner):
        t0, t1 = times[k]
        if own in tok_times:
            tok_times[own] = (min(tok_times[own][0], t0), max(tok_times[own][1], t1))
        else:
            tok_times[own] = (t0, t1)
            tok_src[own] = source[k]

    overrides = {}
    if os.path.exists(a.overrides):
        with open(a.overrides, encoding="utf-8") as f:
            overrides = json.load(f)

    out_phr = []
    last_end = 0.0
    for li, phrases in enumerate(lines):
        for pi, ph in enumerate(phrases):
            toks = []
            for ti, tok in enumerate(ph["tokens"]):
                if (li, pi, ti) in tok_times:
                    t0, t1 = tok_times[(li, pi, ti)]
                elif tok["s"] in "、。，,.！？!?・…" and toks:  # punctuation: with the glyph before it
                    t0, t1 = toks[-1]["t0"], toks[-1]["t1"]
                else:  # unsung kana such as っ: when the glyph before it ends
                    t0 = toks[-1]["t1"] if toks else last_end
                    t1 = t0
                toks.append({"s": tok["s"], "r": tok["r"], "t0": round(t0, 3), "t1": round(t1, 3)})
            key = f"L{li + 1}P{pi}"
            ov = overrides.get(key, {})
            shift = ov.get("shift", 0.0)
            if "start" in ov:
                shift = ov["start"] - toks[0]["t0"]
            if shift:
                for t in toks:
                    t["t0"] = round(t["t0"] + shift, 3)
                    t["t1"] = round(t["t1"] + shift, 3)
            # per-glyph overrides: "L18P0@12" (token index, negative counts from the end)
            for ti in range(len(toks)):
                for k2 in (f"{key}@{ti}", f"{key}@{ti - len(toks)}"):
                    g = overrides.get(k2)
                    if g:
                        if "t0" in g:
                            toks[ti]["t0"] = round(float(g["t0"]), 3)
                        if "shift" in g:
                            toks[ti]["t0"] = round(toks[ti]["t0"] + float(g["shift"]), 3)
                        toks[ti]["t1"] = max(toks[ti]["t1"], toks[ti]["t0"] + 0.05)
            for ti, t in enumerate(toks):
                t["src"] = tok_src.get((li, pi, ti), "punct")
            start, end = min(t["t0"] for t in toks), max(t["t1"] for t in toks)
            last_end = end
            nread = sum(len(t["read"]) for t in ph["tokens"])
            nmatch = sum(1 for k, own in enumerate(owner) if own[:2] == (li, pi) and mapping[k] is not None)
            out_phr.append({
                "id": key, "line": li + 1, "idx": pi, "whisper": ph["whisper"],
                "start": start, "end": round(end, 3),
                "text": "".join(t["s"] for t in toks), "tokens": toks,
                "match": round(nmatch / nread, 2) if nread else 1.0,
            })

    out = {
        "lines": [{"line": i + 1, "trans": trans[i] if i < len(trans) else ""} for i in range(len(lines))],
        "phrases": out_phr,
        "matchRatio": round(matched / max(1, len(a_chars)), 3),
    }
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)

    # human-readable report: every glyph, its time, and the SVP note it is bound to
    import bisect
    def note_at(t):
        i = bisect.bisect_left(b0, t - 1e-4)
        best = min((j for j in (i - 1, i) if 0 <= j < len(b0)), key=lambda j: abs(b0[j] - t), default=None)
        return b_raw[best] if best is not None and abs(b0[best] - t) < 0.02 else ""
    rep = os.path.join(os.path.dirname(os.path.abspath(a.lyrics)), "timing_report.txt")
    with open(rep, "w", encoding="utf-8") as f:
        f.write("glyph timing (data seconds; add audioStartOffsetSec for audio time)\n")
        f.write("src: match = same kana as the SVP note, gap = bound to the SVP note sung in its place, interp = estimated\n")
        f.write("fix a glyph in lyrics.overrides.json, e.g.  {\"L18P0@-1\": {\"t0\": 104.25}}  (@index, negative = from the end)\n\n")
        for p in out_phr:
            f.write(f"{p['id']}{' (whisper)' if p['whisper'] else ''}\n")
            for ti, t in enumerate(p["tokens"]):
                mm, ss = divmod(t["t0"], 60)
                f.write(f"   @{ti:<3} {t['s']:<4} {int(mm)}:{ss:06.3f}  {t['src']:<6} svp:{note_at(t['t0'])!r}\n")
    print(f"[align] wrote {rep}")
    print(f"[align] {len(out_phr)} phrases, kana matched {matched}/{len(a_chars)} ({out['matchRatio']:.0%})")
    for p in out_phr:
        flag = "  <-- check" if p["match"] < 0.5 else ""
        w = "w" if p["whisper"] else " "
        print(f"  {p['id']:>7} {w} {p['start']:7.2f}-{p['end']:7.2f}  match {p['match']:.2f}{flag}")


if __name__ == "__main__":
    main()
