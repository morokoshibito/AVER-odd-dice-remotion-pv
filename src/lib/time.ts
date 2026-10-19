import {useCurrentFrame, useVideoConfig} from 'remotion';
import timing from '../data/timing.json';
import features from '../data/audio_features.json';
import {AUDIO_START_OFFSET_SEC} from '../config';

export type Beat = {t: number; bar: number; beat: number; num: number; bpm: number; down: boolean};
const BEATS = timing.beats as Beat[];
export const DURATION = Math.max(timing.duration, (features as {duration: number}).duration || 0);

/** Current time in data seconds (see AUDIO_START_OFFSET_SEC). */
export const useT = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps - AUDIO_START_OFFSET_SEC;
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** exponential decay envelope; since<0 -> 0 */
export const pulse = (since: number, decay: number) => (since < 0 ? 0 : Math.exp(-since / decay));

const lastIndexAtOrBefore = (t: number) => {
  let lo = 0;
  let hi = BEATS.length - 1;
  if (!BEATS.length || t < BEATS[0].t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (BEATS[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

export type BeatInfo = {
  beat: Beat | null;
  sinceBeat: number;
  sinceDown: number;
  phase: number; // 0..1 inside current beat
  bpm: number;
  num: number;
  recent: number[]; // seconds since each of the last 8 beats (newest first)
};

export const beatInfo = (t: number): BeatInfo => {
  const i = lastIndexAtOrBefore(t);
  if (i < 0) return {beat: null, sinceBeat: 99, sinceDown: 99, phase: 0, bpm: 165, num: 4, recent: []};
  const b = BEATS[i];
  const next = BEATS[i + 1];
  let j = i;
  while (j > 0 && !BEATS[j].down) j--;
  const recent: number[] = [];
  for (let k = i; k >= 0 && recent.length < 8; k--) recent.push(t - BEATS[k].t);
  return {
    beat: b,
    sinceBeat: t - b.t,
    sinceDown: t - BEATS[j].t,
    phase: next ? clamp((t - b.t) / (next.t - b.t)) : 0,
    bpm: b.bpm,
    num: b.num,
    recent,
  };
};

/** Beats inside [t-window, t] (for ripples etc.) */
export const beatsInWindow = (t: number, window: number, downOnly = false) => {
  const i = lastIndexAtOrBefore(t);
  const out: Beat[] = [];
  for (let k = i; k >= 0 && BEATS[k].t >= t - window; k--) {
    if (!downOnly || BEATS[k].down) out.push(BEATS[k]);
  }
  return out;
};

type FeatureKey = 'rms' | 'bass' | 'mid' | 'high';
const F = features as unknown as Record<FeatureKey, number[]> & {rate: number};
/** audio feature 0..1 at time t (0 when analyze_audio.py was not run) */
export const feat = (t: number, key: FeatureKey, smoothFrames = 2) => {
  const arr = F[key];
  if (!arr || !arr.length) return 0;
  const x = (t + AUDIO_START_OFFSET_SEC) * F.rate;
  let s = 0;
  let n = 0;
  for (let k = -smoothFrames; k <= smoothFrames; k++) {
    const idx = Math.round(x) + k;
    if (idx >= 0 && idx < arr.length) {
      s += arr[idx];
      n++;
    }
  }
  return n ? s / n : 0;
};
export const hasAudioFeatures = () => !!(F.rms && F.rms.length);
