import data from '../data/lyrics.json';
import {
  DEFAULT_STYLE, GLYPH_TIMING, LYRIC_STYLE, REVEAL_SPEED, LyricStyle, MOMENT_FALLBACK, OUTRO_START, PHRASE_FALLBACK, PRE_END, PRE_START, WHISPER_DEFAULT,
} from '../direction';

export type Token = {s: string; r: string | null; t0: number; t1: number; k?: number}; // k: entry-animation speed-up (set below)
export type Phrase = {
  id: string;
  line: number;
  idx: number;
  whisper: boolean;
  start: number;
  end: number;
  text: string;
  tokens: Token[];
  match: number;
};
export type LyricsData = {lines: {line: number; trans: string}[]; phrases: Phrase[]; matchRatio: number};

export const LYRICS = data as unknown as LyricsData;
export const PHRASES: Phrase[] = LYRICS.phrases;

export const styleOf = (p: Phrase): LyricStyle =>
  LYRIC_STYLE[p.id] ?? LYRIC_STYLE[`L${p.line}`] ?? (p.whisper ? WHISPER_DEFAULT : DEFAULT_STYLE);

export const isRoll = (s: LyricStyle) => s === 'roll' || s === 'rollYou';
const group = (s: LyricStyle) => (isRoll(s) ? 'roll' : s === 'rainMirror' || s === 'drip' ? 'rain' : s);
const MOMENT: LyricStyle[] = ['count', 'freeze', 'hero'];

/** seconds each style needs to leave the screen */
export const EXIT: Partial<Record<LyricStyle, number>> = {
  rain: 0.55, rainMirror: 0.55, drip: 0.8, tower: 0.9, roll: 0.26, rollYou: 0.26, you: 0.5, ink: 0.6,
  edge: 0.45, fall: 0.5, bubble: 0.5, erase: 0.2, question: 0.4, count: 0.08, freeze: 0.7, hero: 0.45, final: 0.6,
  whisper: 0.4, plain: 0.35,
};

export type Timed = Phrase & {
  style: LyricStyle;
  hideAt: number;
  instant: boolean; // true → vanishes in one frame at hideAt (hard cut), no exit animation
  prevSame: Timed | null; // previous phrase in the same visual group (e.g. the roll reel)
  nextSame: Timed | null;
  prefix: number; // roll: number of leading tokens that form the fixed "anchor"
  anchor: string;
  groupIndex: number; // position inside the group (tower columns)
};

/** the anchor ends at the first particle で / は within the first 4 tokens */
const prefixOf = (p: Phrase) => {
  const i = p.tokens.slice(0, 4).findIndex((t) => t.s === 'で' || t.s === 'は');
  return i < 0 ? 0 : i + 1;
};

/**
 * Timing rules
 *  - every glyph appears at the moment it is sung (from the SVP); nothing is shown early
 *  - a line leaves with its exit animation only if that finishes before the next line begins;
 *    otherwise it is cut in one frame when the next line begins
 *  - chorus lines are cuts: the previous line vanishes the instant the next one starts
 *  - a Vox 2 moment (hard cut to black) removes whatever is on screen in that same frame;
 *    glyphs sung right at the cut are pulled 0.2 s earlier so they are actually seen
 */
/** hand-tuned glyph times from direction.ts */
const retime = (p: Phrase): Token[] => {
  const toks = p.tokens.map((t) => ({...t}));
  const n = toks.length;
  toks.forEach((_tok, i) => {
    const fix = GLYPH_TIMING[`${p.id}@${i}`] ?? GLYPH_TIMING[`${p.id}@${i - n}`];
    if (!fix) return;
    let t0 = toks[i].t0;
    if (fix.with !== undefined && toks[i + fix.with]) t0 = toks[i + fix.with].t0;
    toks[i].t0 = t0 + (fix.shift ?? 0);
    toks[i].t1 = Math.max(toks[i].t1, toks[i].t0 + 0.05);
  });
  // fast lines: reveal the glyphs faster than they are sung so the line can actually be read
  const speed = REVEAL_SPEED[p.id] ?? 1;
  if (speed > 1 && n) {
    const s0 = Math.min(...toks.map((t) => t.t0));
    toks.forEach((tok) => {
      tok.t0 = s0 + (tok.t0 - s0) / speed;
      tok.t1 = Math.max(tok.t0 + 0.05, tok.t1);
    });
  }
  // punctuation right after a retimed glyph follows it
  toks.forEach((tok, i) => {
    if (i > 0 && /^[、。，,.！？!?]$/.test(tok.s) && tok.t0 > toks[i - 1].t0) tok.t0 = toks[i - 1].t0;
  });
  return toks;
};

const compute = (): Timed[] => {
  const all: Timed[] = PHRASES.map((p) => {
    const style = styleOf(p);
    const prefix = isRoll(style) ? prefixOf(p) : 0;
    const tokens = retime(p);
    return {
      ...p, tokens, start: Math.min(p.start, ...tokens.map((t) => t.t0)), style, hideAt: p.end + 1, instant: false,
      prevSame: null, nextSame: null, prefix, anchor: p.tokens.slice(0, prefix).map((t) => t.s).join(''), groupIndex: 0,
    };
  });
  const main = all.filter((p) => !p.whisper).sort((a, b) => a.start - b.start);
  const whis = all.filter((p) => p.whisper).sort((a, b) => a.start - b.start);

  // groups of consecutive phrases sharing a visual system
  for (const list of [main, whis]) {
    list.forEach((p, i) => {
      const q = list[i + 1];
      if (q && group(q.style) === group(p.style) && (p.style === 'tower' || isRoll(p.style) || p.whisper)) {
        p.nextSame = q;
        q.prevSame = p;
        q.groupIndex = p.groupIndex + 1;
      }
    });
  }

  main.forEach((p, i) => {
    const next = main[i + 1];
    const lastGlyph = p.tokens[p.tokens.length - 1]?.t0 ?? p.end;
    const exit = EXIT[p.style] ?? 0.35;
    if (p.style === 'tower') p.hideAt = PRE_END;
    else if (isRoll(p.style)) {
      p.hideAt = next ? Math.min(p.end + 1, next.start) : p.end + 1;
      p.instant = !!next && p.hideAt >= next.start - 1e-3;
    } else if (p.style === 'final') p.hideAt = Math.max(p.end + 0.6, OUTRO_START + 0.4);
    else if (!next) p.hideAt = p.end + 0.8;
    else if (p.end + 0.8 + exit <= next.start) p.hideAt = p.end + 0.8;
    else if (next.start - exit >= lastGlyph + 0.6) p.hideAt = next.start - exit; // last glyph gets ≥0.6 s whole before the exit starts
    else {
      p.hideAt = next.start;
      p.instant = true;
    }
    // a Vox 2 moment cuts to black: the line is gone in the same frame
    if (p.style !== 'tower') {
      const m = whis.find((w) => MOMENT.includes(w.style) && w.start > p.start + 0.05 && w.start < p.hideAt + EXIT_PAD);
      if (m) {
        p.hideAt = m.start - 0.06;
        p.instant = true;
        let limit = p.hideAt - 0.2;
        for (let k = p.tokens.length - 1; k >= 0; k--) {
          if (p.tokens[k].t0 > limit) p.tokens[k].t0 = Math.max(p.start, limit);
          limit = Math.min(limit, p.tokens[k].t0) - 0.05;
        }
      }
    }
  });

  whis.forEach((p) => {
    const nextMain = main.find((q) => q.start > p.start);
    if (p.style === 'count') {
      p.hideAt = p.nextSame && p.nextSame.style === 'count' ? p.nextSame.start : PRE_START;
      p.instant = true;
    } else if (p.style === 'freeze') {
      // the chorus's first words start → the whisper is gone in that frame
      p.hideAt = nextMain ? Math.min(nextMain.start, PRE_END) : PRE_END;
      p.instant = true;
    } else if (p.style === 'hero') {
      const exit = EXIT.hero ?? 0.45;
      if (nextMain && p.end + 0.4 + exit > nextMain.start) {
        p.hideAt = Math.max(p.end, nextMain.start - exit);
      } else p.hideAt = p.end + 0.4;
    } else p.hideAt = p.end + 0.6;
  });

  // A glyph sung just before a hard cut is only on screen for a moment (fast lines run straight into
  // the next one). Speed its entry animation up so it is fully formed for most of that moment instead
  // of still blurring in when the cut comes – otherwise it reads as "late".
  for (const p of all) {
    if (!p.instant) continue;
    for (const tok of p.tokens) {
      const avail = p.hideAt - tok.t0;
      if (avail < 0.6) tok.k = Math.min(6, Math.max(1, ENTRY_REF / (0.6 * Math.max(avail, 0.1))));
    }
  }
  return all;
};
const ENTRY_REF = 0.35; // typical entry length of a glyph animation
const EXIT_PAD = 1.0;
export const TIMED = compute();

/** resolve 'L2P0' / 'L21P0:落' / number to seconds. which='start'|'end' */
export const resolveRef = (ref: string | number, which: 'start' | 'end'): number => {
  if (typeof ref === 'number') return ref;
  const [pid, ch] = ref.split(':');
  const p = PHRASES.find((q) => q.id === pid);
  if (p) {
    if (ch) {
      const tok = p.tokens.find((t) => t.s.includes(ch));
      if (tok) return tok.t0;
    }
    return which === 'start' ? p.start : p.end;
  }
  const fb = PHRASE_FALLBACK[ref] ?? PHRASE_FALLBACK[pid];
  if (fb) return ch ? fb[0] : which === 'start' ? fb[0] : fb[1];
  return -999;
};

/** times of the Vox 2 moments (from lyrics.json, or measured fallbacks) */
export const MOMENTS = (() => {
  const by = (s: LyricStyle) => TIMED.filter((p) => p.style === s).sort((a, b) => a.start - b.start);
  const count = by('count');
  const freeze = by('freeze');
  const hero = by('hero')[0];
  const fin = by('final')[0];
  return {
    count: count.length ? ([count[0].start, PRE_START] as [number, number]) : MOMENT_FALLBACK.count,
    freeze: freeze.length
      ? ([freeze[0].start, (freeze[1] ?? freeze[0]).start, PRE_END] as [number, number, number])
      : MOMENT_FALLBACK.freeze,
    hero: hero ? ([hero.start, hero.end] as [number, number]) : MOMENT_FALLBACK.hero,
    finalStart: fin ? fin.start : MOMENT_FALLBACK.finalStart,
    finalLast: fin ? fin.tokens[fin.tokens.length - 1].t0 : MOMENT_FALLBACK.finalLast,
  };
})();

export const translationFor = (line: number) => LYRICS.lines.find((l) => l.line === line)?.trans ?? '';
