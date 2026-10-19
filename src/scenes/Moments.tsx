import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CHORUS2_START, OUTRO_START, PRE_END, PRE_START} from '../direction';
import {useT} from '../lib/time';
import {MOMENTS} from '../lib/lyrics';

/**
 * The Vox 2 lines get their own cuts: a hard cut to pure black (nothing of the
 * atmosphere remains) and only the animated words, drawn by the lyric layer.
 *   count   0:49  whispered 1–5
 *   freeze  1:04  the whisper before the chorus (ends on the chorus downbeat)
 *   hero    2:24  the single still line (ends when chorus 2 opens)
 *   final   2:53  the last line and its final glyph (ends into the outro)
 */
export const BLACKOUTS: [number, number][] = [
  [MOMENTS.count[0] - 0.06, PRE_START],
  [MOMENTS.freeze[0] - 0.06, PRE_END],
  [MOMENTS.hero[0] - 0.04, CHORUS2_START],
  [MOMENTS.finalStart - 0.06, OUTRO_START],
];

/** 1 inside a black cut, 0 outside (hard cuts, no fades) */
export const blackoutAt = (t: number) => (BLACKOUTS.some(([a, b]) => t >= a && t < b) ? 1 : 0);

export const Moments: React.FC = () => {
  const t = useT();
  return blackoutAt(t) ? <AbsoluteFill style={{background: '#000'}} /> : null;
};

/** kept for the atmosphere: rain is never drawn during a black cut */
export const rainFrozen = (_t: number) => 0;
