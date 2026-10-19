import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {H, VISUALIZER_SCALE, W} from '../config';
import {OUTRO_START, RIT_START, SENZA_START} from '../direction';
import {beatInfo, clamp, feat, hasAudioFeatures, smooth, useT} from '../lib/time';
import {FRAG, VERT} from './shaders';

/**
 * 2:57–3:35  (6/4, ♩230) one continuous take: liquid → + crystal → + tunnel, the flow speeding up,
 *            always turning the same way (clockwise). On each downbeat the mirror count and the
 *            colour morph to the next bar's over TRANSITION seconds — nothing ever cuts.
 * 3:35–3:47  (senza tempo) everything decelerates, the colour drains to violet, and the image is
 *            twisted and smeared further and further until nothing of it is recognisable, then
 *            dissolves from the inside.
 * 3:47→      the dark ending backdrop.
 */
const SEGMENTS = [6, 8, 5, 12, 7, 10, 9, 16, 6, 14, 5, 20, 8, 12, 7, 18];
const TRANSITION = 0.45; // seconds a symmetry / colour change takes
const HUE_STEP = 0.137; // palette rotation per bar
const SPIN = 0.18; // rotation speed factor (one direction, all the way)

const build = (t: number) => clamp((t - OUTRO_START) / (SENZA_START - OUTRO_START));
const intensity = (t: number) => {
  if (t < SENZA_START) return 0.3 + 0.7 * smooth(build(t) * 1.6);
  return 1 - 0.55 * smooth((t - SENZA_START) / 3); // calm, but bright enough to watch it twist
};
// flow speeds up with the build, then brakes almost to a stop in senza tempo
const flowSpeed = (t: number) => (t < SENZA_START ? 0.8 + 1.6 * smooth(build(t)) : 2.4 * (1 - 0.97 * smooth((t - SENZA_START) / 3)));
const integrate = (t: number, k: number) => {
  let a = 0;
  const dt = 1 / 60;
  for (let x = OUTRO_START; x < t; x += dt) a += k * flowSpeed(x) * Math.min(dt, t - x);
  return a;
};
/** beat envelope: rises over `attack` s, then decays — never a one-frame jump */
const env = (since: number, attack: number, decay: number) =>
  since < 0 ? 0 : smooth(since / attack) * Math.exp(-Math.max(0, since - attack) / decay);

// the ending (3:36 → 3:49): distortion only ever grows; the dissolve follows it
const WARP_START = SENZA_START + 1.5; // 3:37 → fully twisted by 3:45
const WARP_LEN = 8;
const DISS_START = SENZA_START + 7.8; // 3:43 → gone by 3:48
const DISS_LEN = 5.2;
const warpAt = (t: number) => 1.25 * Math.pow(smooth((t - WARP_START) / WARP_LEN), 1.4);
const dissAt = (t: number) => {
  if (t <= DISS_START) return 0;
  const x = clamp((t - DISS_START) / DISS_LEN);
  return 0.2 + 0.5 * (0.5 * x + 0.5 * smooth(x)); // spread evenly over the noise's real range (~.25–.65)
};

type GL = {gl: WebGLRenderingContext; loc: Record<string, WebGLUniformLocation | null>};
const UNIFORMS = ['uRes', 'uTime', 'uClock', 'uRot', 'uSegA', 'uSegB', 'uSegK', 'uMix', 'uBeat', 'uDown', 'uHigh', 'uBass', 'uHue', 'uFade', 'uRings', 'uInt', 'uBar', 'uWarp', 'uDiss'];
const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
  return s;
};
const setup = (cv: HTMLCanvasElement): GL => {
  const gl = cv.getContext('webgl', {preserveDrawingBuffer: true, antialias: false});
  if (!gl) throw new Error('WebGL unavailable – render with --gl=swangle');
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const loc: GL['loc'] = {};
  UNIFORMS.forEach((n) => (loc[n] = gl.getUniformLocation(prog, n)));
  return {gl, loc};
};

/** the bar grid stops at senza tempo: afterwards everything keeps decaying from the last beat */
const beatState = (t: number) => {
  const tb = Math.min(t, SENZA_START - 0.001);
  const bi = beatInfo(tb);
  const extra = t - tb;
  return {bar: bi.beat?.bar ?? 0, sinceBeat: bi.sinceBeat + extra, sinceDown: bi.sinceDown + extra, recent: bi.recent.map((a) => a + extra)};
};

const hueAt = (t: number, barIdx: number, k: number) => {
  const h = (barIdx - 1 + k) * HUE_STEP;
  if (t < SENZA_START) return h;
  // senza: glide (the short way round) to violet
  const target = h + ((((0.62 - h) % 1) + 1.5) % 1) - 0.5;
  return h + (target - h) * smooth((t - SENZA_START) / 3);
};

export const GeoOutro: React.FC = () => {
  const t = useT();
  const active = t >= OUTRO_START && t < RIT_START + 2.5; // starts exactly when the last black cut ends
  const ref = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GL | null>(null);
  const w = Math.round(W * VISUALIZER_SCALE);
  const h = Math.round(H * VISUALIZER_SCALE);

  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    if (!glRef.current) glRef.current = setup(ref.current);
    const {gl, loc} = glRef.current;
    const bs = beatState(t);
    const bar0 = beatInfo(OUTRO_START + 0.01).beat?.bar ?? 0;
    const barIdx = Math.max(0, bs.bar - bar0);
    // morph progress from the previous bar's look to this bar's
    const k = barIdx === 0 ? 1 : smooth(bs.sinceDown / TRANSITION);
    const segA = SEGMENTS[Math.max(0, barIdx - 1) % SEGMENTS.length];
    const segB = SEGMENTS[barIdx % SEGMENTS.length];
    const rings = new Float32Array(6).fill(99);
    bs.recent.slice(0, 6).forEach((a, i) => (rings[i] = a));

    gl.viewport(0, 0, w, h);
    gl.uniform2f(loc.uRes, w, h);
    gl.uniform1f(loc.uTime, integrate(t, 1));
    gl.uniform1f(loc.uClock, t - OUTRO_START);
    gl.uniform1f(loc.uRot, integrate(t, SPIN)); // always the same direction (clockwise on screen)
    gl.uniform1f(loc.uSegA, segA);
    gl.uniform1f(loc.uSegB, segB);
    gl.uniform1f(loc.uSegK, k);
    gl.uniform1f(loc.uInt, intensity(t));
    gl.uniform1f(loc.uBar, Math.max(0, barIdx - 1 + k));
    gl.uniform1f(loc.uMix, smooth((t - SENZA_START) / (RIT_START - SENZA_START)));
    gl.uniform1f(loc.uBeat, env(bs.sinceBeat, 0.06, 0.14));
    gl.uniform1f(loc.uDown, env(bs.sinceDown, 0.09, 0.32));
    gl.uniform1f(loc.uHigh, hasAudioFeatures() ? feat(t, 'high', 8) : 0.4);
    gl.uniform1f(loc.uBass, hasAudioFeatures() ? feat(t, 'bass', 8) : 0.5);
    gl.uniform1f(loc.uHue, hueAt(t, barIdx, k));
    gl.uniform1f(loc.uFade, smooth((t - OUTRO_START) / 0.6));
    gl.uniform1f(loc.uWarp, warpAt(t));
    gl.uniform1f(loc.uDiss, dissAt(t));
    gl.uniform1fv(loc.uRings, rings);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [t, active, w, h]);

  if (!active) return null;
  const out = 1 - clamp((t - RIT_START) / 2.5); // hand over to the ending backdrop
  return (
    <AbsoluteFill style={{opacity: out}}>
      <canvas ref={ref} width={w} height={h} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};
