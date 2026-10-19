/**
 * DIRECTOR'S SHEET — sections, look per section, lyric styles.
 * Everything on screen is generated (no illustrations). Nothing shakes:
 * motion is always eased drift, growth, rotation, fall or fade.
 *
 * Times are data-seconds (see config.ts). Lyric references use the line numbers
 * of lyrics.txt (1-based) and the phrase index inside a line (0-based):
 * 'L15P1' = line 15, 2nd phrase. 'L21P0:落' = the moment the glyph 落 is sung.
 */
import {PALETTE} from './config';

export type SectionId =
  | 'intro' | 'verse' | 'pre' | 'chorus1' | 'dream' | 'dread' | 'run' | 'fall' | 'deep' | 'hero' | 'chorus2' | 'final'
  | 'outro' | 'senza' | 'rit';

export type Section = {
  id: SectionId;
  start: number;
  end: number;
  enter: 'fade' | 'iris' | 'cut'; // how this section's background arrives
  bg: [string, string]; // background gradient top → bottom
  bgAlt: [string, string] | null; // if set, flips to this on each new lyric phrase (circular wipe from the centre)
  line: string; // colour of the line-art
  rain: number; // 0..1
  rainSpeed: number; // 1 normal, <1 slows (senza tempo)
  ripples: 'beat' | 'down' | 'none'; // top-down rings where drops land
  dice: number; // wireframe dice drifting near the edges
  bokeh: number; // 0..1 large soft out-of-focus lights (depth)
  dust: number; // 0..1 small floating particles
  tower: boolean; // pre-chorus dice tower (one die per beat, one storey per bar)
  ring: boolean; // a wide ring expands from the centre on every downbeat (chorus)
  ink: number; // 0..1 ink clouds creeping in from the edges
  bubbles: number; // 0..1
  flash: number; // 0..1 soft brightness lift on downbeats (nothing moves)
  orbit: number; // 0..1 slowly turning concentric dials around the centre (ticks + die pips)
  rays: number; // 0..1 soft light shafts from above
  glints: number; // 0..1 four-point sparkles
  halo: number; // 0..1 glow behind the lyric area, swelling on downbeats
  streak: boolean; // anamorphic light streak across the centre on downbeats
  burst: boolean; // speed lines + flash when a chorus line cuts in
  aurora: number; // 0..1 slow drifting colour clouds (dream)
  press: number; // 0..1 crimson rings contracting toward the centre on beats (dread)
  warp: number; // 0..1 tunnel speed lines + a floor grid rushing toward the viewer (run)
  ash: number; // 0..1 slow falling ash after the fall
};

const S = (id: SectionId, start: number, end: number, o: Partial<Section>): Section => ({
  id, start, end, enter: 'fade', bg: ['#120c2c', '#24164c'], bgAlt: null, line: PALETTE.lavender, rain: 0.3, rainSpeed: 1,
  ripples: 'down', dice: 0, bokeh: 0.4, dust: 0.4, tower: false, ring: false, ink: 0, bubbles: 0, flash: 0,
  orbit: 0, rays: 0, glints: 0, halo: 0, streak: false, burst: false, aurora: 0, press: 0, warp: 0, ash: 0, ...o,
});

// 0:00 4/4→5/4·6/4 ♩165 | 0:51 accel→230 | 1:06 6/4 230 | 1:34 4/4 145 | 1:59 3/4 145 |
// 2:03 5/4·6/4 165 | 2:18 accel→230 | 2:22 6/4 230 | 3:35 senza tempo | 3:47 3/4 rit.
export const SECTIONS: Section[] = [
  S('intro', 0, 20.3, {rays: 0.3, glints: 0.2, bg: ['#07061a', '#151033'], rain: 0.22, bokeh: 0.25, dust: 0.3}),
  S('verse', 20.3, 51.04, {orbit: 0.6, rays: 0.35, glints: 0.4, halo: 0.5, bg: ['#0f0a29', '#281950'], rain: 0.32, ripples: 'beat', dice: 4, bokeh: 0.6, dust: 0.5}),
  S('pre', 51.04, 66.35, {rays: 0.55, glints: 0.5, halo: 0.4, bg: ['#140c34', '#34205f'], rain: 0.5, ripples: 'beat', dice: 0, bokeh: 0.5, dust: 0.55, tower: true}),
  S('chorus1', 66.35, 94.53, {orbit: 1, rays: 0.5, glints: 1, halo: 1, streak: true, burst: true, enter: 'iris', bg: ['#241048', '#4a2580'], bgAlt: ['#170a33', '#5d3399'], line: '#efe9ff', rain: 0.4, ripples: 'beat', dice: 3, bokeh: 0.8, dust: 0.7, ring: true, flash: 0.22}),
  // ---- C: dream → dread → run → fall (each its own world)
  S('dream', 94.53, 98.4, {bg: ['#120a2e', '#2c1550'], line: '#e6d9ff', aurora: 1, rain: 0.1, ripples: 'none', dice: 7, bokeh: 0.7, dust: 0.6, glints: 0.6, orbit: 0.3, halo: 0.5}),
  S('dread', 98.4, 109.4, {bg: ['#0a0509', '#2a0b18'], line: '#f0c6d2', aurora: 0.25, rain: 0.2, ripples: 'none', dice: 3, bokeh: 0.25, dust: 0.3, ink: 0.85, press: 1, orbit: 0.45, halo: 0.35, flash: 0.15}),
  S('run', 109.4, 116.0, {bg: ['#0b0820', '#22124a'], line: '#dcd2ff', rain: 0.5, rainSpeed: 1.8, ripples: 'none', dice: 0, bokeh: 0.3, dust: 0.4, warp: 1, halo: 0.4}),
  S('fall', 116.0, 130.45, {bg: ['#08060f', '#160f26'], line: '#c9c2f0', rain: 0.2, ripples: 'down', dice: 4, bokeh: 0.2, dust: 0, warp: 1, ash: 1, halo: 0.25}),
  S('deep', 130.45, 144.3, {enter: 'fade', bg: ['#06122b', '#163a62'], line: '#d4e6ff', rays: 1, glints: 0.35, halo: 0.35, rain: 0, ripples: 'none', dice: 2, bokeh: 0.8, dust: 0.3, bubbles: 1}),
  S('hero', 144.3, 147.4, {enter: 'cut', bg: ['#050409', '#0b0916'], rain: 0, ripples: 'none', bokeh: 0, dust: 0.12}),
  S('chorus2', 147.4, 173.0, {orbit: 1, rays: 0.7, glints: 1, halo: 1, streak: true, burst: true, enter: 'iris', bg: ['#38216c', '#6c4cb2'], bgAlt: ['#2a1758', '#7d5dc6'], line: '#ffffff', rain: 0.28, ripples: 'beat', dice: 3, bokeh: 0.9, dust: 0.8, ring: true, flash: 0.22}),
  S('final', 173.0, 176.9, {enter: 'fade', bg: ['#140c2c', '#2b1a50'], rain: 0.08, ripples: 'none', bokeh: 0.5, dust: 0.35}),
  S('outro', 176.9, 215.57, {enter: 'cut', rain: 0, ripples: 'none', bokeh: 0, dust: 0}),
  S('senza', 215.57, 227.65, {enter: 'cut', rain: 0.35, rainSpeed: 0.04, ripples: 'none', bokeh: 0, dust: 0}),
  S('rit', 227.65, 9999, {orbit: 0.3, rays: 0.3, glints: 0.3, bg: ['#07061a', '#151033'], rain: 0.08, rainSpeed: 0.15, ripples: 'down', bokeh: 0.2, dust: 0.2}),
];

export const sectionAt = (t: number) => SECTIONS.find((s) => t >= s.start && t < s.end) ?? SECTIONS[0];
const at = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;
export const PRE_START = at('pre').start;
export const PRE_END = at('pre').end;
export const OUTRO_START = at('outro').start;
export const SENZA_START = at('senza').start;
export const RIT_START = at('rit').start;

// ---------------------------------------------------------------- lyrics
/**
 * Lyric design system — fixed layout: every line sits at its final centred position from the start
 * and each glyph appears in its own place when it is sung (nothing slides sideways).
 *   rain        verse: glyphs settle like drops, with a reflection on the "water" below
 *   rainMirror  same, stronger reflection (the comparing lines)
 *   drip        same, glyphs drip away when the line ends
 *   tower       pre-chorus: vertical columns right of the dice tower, each glyph revealed top → bottom
 *   roll        chorus: the shared opening words (そこで / 僕は / 君は) above, the rest lands with a
 *               gesture taken from its verb (CHORUS_KIND below)
 *   rollYou     the same, warm colour (the "you" line)
 *   you / dream / dread (壊・崩 land cracked) / monster / run (footsteps) / fall / water (bubbles) /
 *   bleed / strike / question / surge (branded in, white-hot, cooling)
 * Vox 2 moments (hard cut to black, see Moments.tsx):
 *   count       whispered 1–5: one die face per number
 *   freeze      まだここにある / 衝迫: both rows on screen at once, each glyph brightens when sung
 *   hero        ここで生きていてよ: glyphs lit like small flames, the line breathes, then glows out
 *   final       the last line; its final glyph (Vox 2) arrives alone
 */
export type LyricStyle =
  | 'plain' | 'rain' | 'rainMirror' | 'drip' | 'tower' | 'roll' | 'rollYou' | 'you'
  | 'ink' | 'edge' | 'fall' | 'bubble' | 'erase' | 'question'
  | 'dream' | 'dread' | 'monster' | 'run' | 'water' | 'bleed' | 'strike' | 'surge'
  | 'count' | 'freeze' | 'hero' | 'final' | 'whisper';

/** style per line (all phrases), or per phrase with 'L<n>P<i>' keys (phrase keys win). */
export const LYRIC_STYLE: Record<string, LyricStyle> = {
  L1: 'rainMirror', L2: 'rainMirror',
  L3: 'drip', L4: 'drip',
  L5: 'rain', L6: 'rain', L7: 'rain', L8: 'rain',
  L8P1: 'count', L8P2: 'count', L8P3: 'count', L8P4: 'count', L8P5: 'count',
  L9: 'tower', L10: 'tower', L11: 'tower',
  L12: 'freeze',
  L13: 'roll', L14: 'roll', L15: 'roll', L16P0: 'roll', L16P1: 'rollYou',
  L17P0: 'you', L17P1: 'dream',
  L18: 'dread', L19: 'monster', L20: 'run', L21: 'fall',
  L22: 'water', L23: 'bleed',
  L24P0: 'strike', L24P1: 'question',
  L25P0: 'surge', L25P1: 'hero',
  L26: 'roll', L27: 'roll', L28: 'roll', L29P0: 'roll', L29P1: 'rollYou',
  L30: 'final',
};
export const DEFAULT_STYLE: LyricStyle = 'plain';
export const WHISPER_DEFAULT: LyricStyle = 'whisper';

export const LYRIC_COLOR: Partial<Record<SectionId, string>> = {
  intro: PALETTE.silver, verse: '#f4f1ff', pre: '#f4f1ff', chorus1: '#ffffff',
  dream: '#f3ecff', dread: '#f6e6ec', run: '#ffffff', fall: '#ece8ff', deep: '#eef6ff', hero: '#ffffff', chorus2: '#ffffff', final: '#fff1e6',
};
export const WARM = '#ffe4d0';

/** Fallback seconds before lyrics.json exists (measured from the SVP). */
export const PHRASE_FALLBACK: Record<string, [number, number]> = {
  L21P0: [116.04, 130.26], 'L21P0:落': [121.84, 122.2],
};
export const MOMENT_FALLBACK = {
  count: [49.23, 51.04] as [number, number],
  freeze: [63.95, 64.77, 66.35] as [number, number, number], // start, 2nd phrase, end
  hero: [144.35, 147.0] as [number, number],
  finalStart: 173.31, // the last line begins
  finalLast: 176.44, // time of the final glyph
};
export const CHORUS2_START = 147.4;

/**
 * Hand-tuned glyph timings (applied on top of the SVP alignment, before everything else).
 * key 'L<line>P<phrase>@<index>'  (index 0 = first glyph, -1 = last)
 *   with: n   → take the time of the glyph n places away (-1 = the glyph before it)
 *   shift: s  → then move by s seconds (negative = earlier)
 */
export const GLYPH_TIMING: Record<string, {with?: number; shift?: number}> = {
  'L17P0@7': {with: -1}, // それでいいと言う: う together with 言
  'L30P0@7': {with: -1}, // それでいいと言う、ね: う together with 言
  'L18P0@-1': {with: -1}, // 躊躇いのない: い together with な
  'L23P0@-1': {shift: -0.15}, // 滲む血も涙も: the last も a little earlier (2:18.25 → 2:18.10)
  'L25P0@-1': {with: -1, shift: 0.26}, // 忘れられない: い 0.26 s after な (2:23.83, where the held vowel starts)
};

/**
 * Chorus: each line's glyphs land in place with a gesture taken from its verb (both choruses).
 * The first matching key in the line wins; anything else smashes in.
 */
export type ChorusKind = 'smash' | 'tear' | 'pop' | 'band' | 'close' | 'turn' | 'turnBack' | 'reach' | 'nod';
export const CHORUS_KIND: [string, ChorusKind][] = [
  ['泣', 'tear'], // 泣いていて   – a tear runs down from each glyph
  ['笑', 'pop'], // 笑っていて   – glyphs pop open, bright
  ['始', 'band'], // 始まって     – a band of light opens, glyphs cut out of it
  ['終', 'close'], // 終わっている – glyphs close in from above and below
  ['振', 'turn'], // 振り返る     – each glyph turns round to face us
  ['伸', 'reach'], // 手を伸ばす   – a line of light reaches out under the glyphs
  ['背', 'turnBack'], // 背を向ける – glyphs turn the other way and dim a little
  ['頷', 'nod'], // 頷いて       – each glyph nods
];

/**
 * Lines that are sung too fast to read glyph by glyph: their glyphs are revealed this many times
 * faster than they are sung (from the line's first glyph), so the whole line is on screen for a
 * while before the next one cuts in. 1 = exactly with the voice.
 */
export const REVEAL_SPEED: Record<string, number> = {
  L24P0: 1.2, // 記されない気付かれない       complete ~0.9 s before the cut (was 0.14 s)
  L24P1: 1.2, // 不幸じゃない？無駄ではない？   complete ~0.8 s before the cut (was 0.13 s)
  L25P0: 1.2, // 嘯いた顔忘れられない         complete ~1.3 s before the cut
};
