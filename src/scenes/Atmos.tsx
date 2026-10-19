import React, {useLayoutEffect, useRef} from 'react';
import {Easing, random} from 'remotion';
import timing from '../data/timing.json';
import {H, W} from '../config';
import {OUTRO_START, PRE_END, PRE_START, RIT_START, sectionAt, SENZA_START} from '../direction';
import {Beat, beatInfo, beatsInWindow, clamp, feat, pulse, smooth, useT} from '../lib/time';
import {isRoll, resolveRef, TIMED} from '../lib/lyrics';
import {rainFrozen} from './Moments';

/**
 * The atmosphere: flat 2D motion graphics on one canvas, every frame a pure
 * function of time. Nothing shakes — things drift, grow, turn slowly, fall or fade.
 */

const r = (k: string) => random(k);
const eo = Easing.out(Easing.cubic);
const FALL_T = resolveRef('L21P0:落', 'start');
/** moments a chorus line cuts in (its first rolling glyph) — speed lines + flash */
const CUTS = TIMED.filter((p) => isRoll(p.style) || p.style === 'you')
  .map((p) => p.tokens[p.prefix]?.t0 ?? p.start) // the moment the line's big word is sung
  .sort((a, b) => a - b);

// ------------------------------------------------------------ ornaments
const drawRays = (g: CanvasRenderingContext2D, t: number, amt: number, color: string) => {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(28px)';
  for (let i = 0; i < 6; i++) {
    const k = `ray${i}`;
    const x0 = W * (0.08 + 0.17 * i) + Math.sin(t * 0.05 + i * 1.7) * 70;
    const ang = 0.22 + 0.07 * Math.sin(t * 0.06 + i * 2.3);
    const w0 = 50 + 70 * r(k);
    const w1 = w0 * 3.2;
    const dx = Math.tan(ang) * H * 1.1;
    const grad = g.createLinearGradient(0, -40, 0, H * 1.05);
    const a = amt * (0.07 + 0.07 * r(k + 'a')) * (0.75 + 0.25 * Math.sin(t * 0.4 + i));
    grad.addColorStop(0, rgba(color, a));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 - w0 / 2, -40);
    g.lineTo(x0 + w0 / 2, -40);
    g.lineTo(x0 + dx + w1 / 2, H * 1.05);
    g.lineTo(x0 + dx - w1 / 2, H * 1.05);
    g.closePath();
    g.fill();
  }
  g.restore();
};

const PIP_SETS: [number, number][][] = [
  [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
];
/** concentric dials: hairline rings, tick marks and die-pip clusters, each turning slowly */
const drawOrbit = (g: CanvasRenderingContext2D, t: number, amt: number, color: string, bloom: number) => {
  const a = amt * (1 + 0.6 * bloom);
  g.save();
  g.translate(W / 2, H / 2);
  const rings: [number, number, number][] = [
    [0.27, 0.05, 72], [0.38, -0.03, 0], [0.5, 0.018, 144], [0.66, -0.012, 36],
  ];
  rings.forEach(([rr, sp, ticks], j) => {
    const R = rr * H;
    g.save();
    g.rotate(t * sp + j);
    g.strokeStyle = rgba(color, 0.16 * a);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < ticks; k++) {
      const ang = (k / ticks) * Math.PI * 2;
      const long = k % 6 === 0;
      const l0 = R - (long ? 10 : 4);
      g.strokeStyle = rgba(color, (long ? 0.32 : 0.18) * a);
      g.beginPath();
      g.moveTo(Math.cos(ang) * l0, Math.sin(ang) * l0);
      g.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
      g.stroke();
    }
    if (j === 1) {
      // six die faces (1–6) set around the middle ring
      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI * 2;
        const cx = Math.cos(ang) * R;
        const cy = Math.sin(ang) * R;
        g.fillStyle = rgba(color, 0.45 * a);
        for (const [px, py] of PIP_SETS[f]) {
          g.beginPath();
          g.arc(cx + px * 6, cy + py * 6, 2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  });
  g.restore();
};


/** dream: slow colour clouds, additive */
const drawAurora = (g: CanvasRenderingContext2D, t: number, amt: number) => {
  const cols = ['#b04bd8', '#5b3df0', '#3fb6e8', '#e0559b', '#7a5cff', '#4fd0c0'];
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(60px)';
  cols.forEach((c, i) => {
    const k = `au${i}`;
    const x = W * (0.15 + 0.7 * r(k + 'x')) + Math.sin(t * 0.07 + i * 1.3) * W * 0.16;
    const y = H * (0.2 + 0.6 * r(k + 'y')) + Math.cos(t * 0.05 + i) * H * 0.14;
    const rad = H * (0.32 + 0.26 * r(k + 'r'));
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(c, 0.26 * amt));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();
};

/** dread: crimson rings contracting toward the centre on every beat, edges pulsing red on downbeats */
const drawPress = (g: CanvasRenderingContext2D, t: number, amt: number, bloom: number) => {
  const life = 1.5;
  for (const b of beatsInWindow(t, life, false)) {
    const age = t - b.t;
    const k = eo(clamp(age / life));
    const R = H * (0.85 - 0.72 * k);
    const a = amt * Math.min(1, age / 0.15) * (1 - age / life) * (b.down ? 0.7 : 0.4);
    g.strokeStyle = rgba('#d0244c', a);
    g.lineWidth = (b.down ? 2.5 : 1.2) + 3 * k;
    g.beginPath();
    g.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    g.stroke();
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(160,20,50,0)');
  v.addColorStop(1, `rgba(160,20,50,${amt * (0.18 + 0.3 * bloom)})`);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
};

/** run: tunnel speed lines from the centre + a floor grid rushing toward the viewer */
const drawWarp = (g: CanvasRenderingContext2D, t: number, amt: number, color: string, speed: number, dropY: number) => {
  if (amt <= 0.01) return;
  g.save();
  g.translate(0, dropY);
  for (let i = 0; i < 110; i++) {
    const k = `wp${i}`;
    const ang = r(k) * Math.PI * 2;
    const d = (t * speed * (0.35 + 0.5 * r(k + 's')) + r(k + 'p')) % 1;
    const r0 = H * 0.04 + Math.pow(d, 2.2) * H * 1.25;
    const len = r0 * (0.12 + 0.3 * d);
    g.strokeStyle = rgba(color, amt * 0.6 * d);
    g.lineWidth = 0.6 + 1.8 * d;
    g.beginPath();
    g.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
    g.lineTo(W / 2 + Math.cos(ang) * (r0 + len), H / 2 + Math.sin(ang) * (r0 + len));
    g.stroke();
  }
  const hz = H * 0.58;
  for (let k = 0; k < 16; k++) {
    const u = ((k / 16) + t * 0.55 * speed) % 1;
    const y = hz + (H - hz) * Math.pow(u, 2.4);
    g.strokeStyle = rgba(color, amt * 0.35 * u);
    g.lineWidth = 0.5 + 1.5 * u;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  for (let m = -10; m <= 10; m++) {
    g.strokeStyle = rgba(color, amt * 0.22);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W / 2 + m * 10, hz);
    g.lineTo(W / 2 + m * W * 0.14, H);
    g.stroke();
  }
  const hg = g.createLinearGradient(0, hz - 60, 0, hz + 60);
  hg.addColorStop(0, rgba(color, 0));
  hg.addColorStop(0.5, rgba(color, amt * 0.25));
  hg.addColorStop(1, rgba(color, 0));
  g.fillStyle = hg;
  g.fillRect(0, hz - 60, W, 120);
  g.restore();
};

/** after the fall: ash flakes drifting down, turning slowly */
const drawAsh = (g: CanvasRenderingContext2D, t: number, amt: number, color: string) => {
  const n = Math.round(90 * amt);
  for (let i = 0; i < n; i++) {
    const k = `ash${i}`;
    const sp = 25 + 45 * r(k + 's');
    const y = ((t * sp + r(k + 'y') * (H + 40)) % (H + 40)) - 20;
    const x = r(k + 'x') * W + Math.sin(t * (0.3 + 0.4 * r(k + 'w')) + i) * 30;
    const sz = 1.5 + 4 * r(k + 'z');
    g.save();
    g.translate(x, y);
    g.rotate(t * (0.5 + r(k + 'r')) + i);
    g.fillStyle = rgba(color, 0.18 + 0.3 * r(k + 'a'));
    g.fillRect(-sz, -sz * 0.4, sz * 2, sz * 0.8);
    g.restore();
  }
};

const drawGlints = (g: CanvasRenderingContext2D, t: number, amt: number, color: string) => {
  const n = Math.round(amt * 28);
  for (let i = 0; i < n; i++) {
    const k = `gl${i}`;
    const x = r(k + 'x') * W;
    const y = r(k + 'y') * H;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.7 + 0.9 * r(k + 's')) + i * 2.1);
    const a = Math.pow(tw, 3) * 0.85;
    if (a < 0.03) continue;
    const s = (5 + 13 * r(k + 'z')) * (0.6 + 0.4 * tw);
    g.strokeStyle = rgba(color, a);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - s, y); g.lineTo(x + s, y);
    g.moveTo(x, y - s); g.lineTo(x, y + s);
    g.stroke();
    g.fillStyle = rgba(color, a * 0.35);
    g.beginPath();
    g.arc(x, y, s * 0.35, 0, Math.PI * 2);
    g.fill();
  }
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a)})`;
};

// ------------------------------------------------------------ 3×3 rotation matrices
type V3 = [number, number, number];
type M3 = number[]; // row-major 9
const Rx = (a: number): M3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const Ry = (a: number): M3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const Rz = (a: number): M3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul = (A: M3, B: M3): M3 => {
  const o: M3 = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]);
  return o;
};
const ap = (M: M3, v: V3): V3 => [
  M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
  M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
  M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
];

// ------------------------------------------------------------ die: visible faces, optional fill (for occlusion), pips
const FACES: [V3, V3, V3, number][] = [
  [[0, 0, 1], [1, 0, 0], [0, 1, 0], 1], [[0, 0, -1], [-1, 0, 0], [0, 1, 0], 6],
  [[1, 0, 0], [0, 0, -1], [0, 1, 0], 3], [[-1, 0, 0], [0, 0, 1], [0, 1, 0], 4],
  [[0, -1, 0], [1, 0, 0], [0, 0, -1], 5], [[0, 1, 0], [1, 0, 0], [0, 0, 1], 2],
];
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-0.5, -0.5], [0.5, 0.5]], 3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0], [0.5, 0], [-0.5, 0.55], [0.5, 0.55]],
};
const drawDie = (g: CanvasRenderingContext2D, cx: number, cy: number, size: number, M: M3, line: string, alpha: number, fill?: string) => {
  if (alpha <= 0.01) return;
  for (const [n, u, v, pips] of FACES) {
    const nn = ap(M, n);
    if (nn[2] <= 0.02) continue;
    const uu = ap(M, u);
    const vv = ap(M, v);
    const P = (s: number, t: number) => [cx + (nn[0] + uu[0] * s + vv[0] * t) * size, cy + (nn[1] + uu[1] * s + vv[1] * t) * size];
    const c = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
    g.beginPath();
    g.moveTo(c[0][0], c[0][1]);
    for (let i = 1; i < 4; i++) g.lineTo(c[i][0], c[i][1]);
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.globalAlpha = alpha;
      g.fill();
      g.globalAlpha = 1;
    }
    g.strokeStyle = rgba(line, alpha);
    g.lineWidth = 1.3;
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = rgba(line, alpha * 0.95);
    const pr = size * 0.15 * Math.sqrt(nn[2]);
    for (const [s, t] of PIPS[pips]) {
      const [x, y] = P(s, t);
      g.beginPath();
      g.arc(x, y, pr, 0, Math.PI * 2);
      g.fill();
    }
  }
};

// ------------------------------------------------------------ the pre-chorus dice tower
// one die per beat, one storey per bar (the section is 8 bars of 6/4 → 8 × 6 dice).
const PRE_BEATS = (timing.beats as Beat[]).filter((b) => b.t >= PRE_START - 0.01 && b.t < PRE_END - 0.01);
const PRE_BARS = Array.from(new Set(PRE_BEATS.map((b) => b.bar)));
const VIEW = mul(Rx(-0.36), Ry(0.5));
const TOWER = (() => {
  const size = 21;
  const span = size * 2.08;
  return PRE_BEATS.map((b, i) => {
    const row = PRE_BARS.indexOf(b.bar);
    const k = `tw${i}`;
    const offset = row % 2 ? span / 2 : 0;
    const local: V3 = [(b.beat - (b.num - 1) / 2) * span + offset - span / 4, -row * span, (r(k + 'z') - 0.5) * 6];
    const orient = mul(Ry((r(k + 'y') - 0.5) * 0.35), mul(Rx(Math.floor(r(k + 'a') * 4) * (Math.PI / 2)), Ry(Math.floor(r(k + 'b') * 4) * (Math.PI / 2))));
    return {t: b.t, row, size, local, orient, key: k};
  });
})();

const drawTower = (g: CanvasRenderingContext2D, t: number, line: string, fill: string) => {
  const baseX = W / 2;
  const baseY = H * 0.84;
  const growth = clamp((t - PRE_START) / (PRE_END - PRE_START));
  const lean = 0.05 * eo(growth); // the tower leans a little more as it grows (static, never wobbles)
  const tc = t - PRE_END; // collapse clock
  const items = TOWER.filter((d) => d.t <= t).map((d) => {
    const p = ap(VIEW, d.local);
    const lx = p[0] * Math.cos(lean) - p[1] * Math.sin(lean);
    const ly = p[0] * Math.sin(lean) + p[1] * Math.cos(lean);
    let x = baseX + lx;
    let y = baseY + ly;
    let M = mul(Rz(lean), mul(VIEW, d.orient));
    let alpha = 0.85;
    // land: drop 50 px into place
    const a = eo(clamp((t - d.t) / 0.22));
    y -= (1 - a) * 50;
    alpha *= a;
    if (tc > 0) {
      // collapse on the chorus downbeat: outward, up, then gravity; a slow spin; fade
      const dir = (lx / 140) + (r(d.key + 'v') - 0.5) * 0.8;
      x += dir * 520 * tc;
      y += -(260 + r(d.key + 'u') * 260) * tc + 0.5 * 1900 * tc * tc;
      M = mul(Rx(tc * (2 + 3 * r(d.key + 's'))), mul(Ry(tc * (1.5 + 2 * r(d.key + 't'))), M));
      alpha *= 1 - clamp(tc / 1.5);
    }
    return {x, y, z: p[2], M, alpha, size: d.size};
  });
  items.sort((a, b) => a.z - b.z || b.y - a.y);
  for (const it of items) drawDie(g, it.x, it.y, it.size, it.M, line, it.alpha, fill);
};

// ------------------------------------------------------------ rain clock: slows in senza tempo, stops during the freeze
const rainSpeedAt = (t: number) => sectionAt(t).rainSpeed * (1 - rainFrozen(t));
const RAIN_DT = 1 / 30;
const rainClock = (t: number) => {
  let acc = 0;
  for (let x = 0; x < t; x += RAIN_DT) acc += rainSpeedAt(x) * Math.min(RAIN_DT, t - x);
  return acc;
};

/** keep decorative elements out of the central lyric area */
const awayFromCentre = (x: number, y: number): [number, number] => {
  const dx = x - W / 2;
  const dy = y - H / 2;
  if (Math.abs(dx) < W * 0.24 && Math.abs(dy) < H * 0.2) return [W / 2 + Math.sign(dx || 1) * W * (0.26 + 0.1 * Math.abs(dx) / W), y];
  return [x, y];
};

export const Atmos: React.FC<{phase: 'main' | 'over'}> = ({phase}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useLayoutEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const s = sectionAt(t);
    const shaderTime = t >= OUTRO_START && t < RIT_START;
    if (phase === 'main' && shaderTime) return;
    if (phase === 'over' && t < SENZA_START) return;

    const fallY = s.id === 'fall' && t > FALL_T ? (t - FALL_T) * (t - FALL_T) * 520 : 0;
    const fadeIn = clamp((t - s.start) / 1.2);

    // ---------------- bokeh: depth behind everything
    if (phase === 'main' && s.bokeh > 0) {
      const nb = Math.round(s.bokeh * 12);
      for (let i = 0; i < nb; i++) {
        const k = `bk${s.id}${i}`;
        const rad = 70 + r(k + 'r') * 190;
        const x = r(k + 'x') * W + Math.sin(t * 0.03 + i * 1.3) * 90;
        const y = r(k + 'y') * H + Math.cos(t * 0.025 + i) * 50 + fallY * 0.3;
        const a = (0.035 + 0.06 * r(k + 'a')) * fadeIn;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, rgba(s.line, a));
        grad.addColorStop(0.7, rgba(s.line, a * 0.5));
        grad.addColorStop(1, rgba(s.line, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.fill();
      }
    }

    const bi = beatInfo(t);
    const bloom = bi.beat?.down ? pulse(bi.sinceBeat, 0.35) : 0;
    if (phase === 'main') {
      if (s.aurora > 0) drawAurora(g, t, s.aurora * fadeIn);
      if (s.rays > 0) drawRays(g, t, s.rays * fadeIn, s.line);
      if (s.halo > 0) {
        const hr = H * 0.62;
        const hg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, hr);
        hg.addColorStop(0, rgba(s.line, s.halo * (0.1 + 0.16 * bloom) * fadeIn));
        hg.addColorStop(1, rgba(s.line, 0));
        g.fillStyle = hg;
        g.fillRect(0, 0, W, H);
      }
      if (s.orbit > 0) drawOrbit(g, t, s.orbit * fadeIn, s.line, bloom);
      if (s.press > 0) drawPress(g, t, s.press * fadeIn * (0.35 + 0.65 * clamp((t - s.start) / (s.end - s.start))), bloom);
      if (s.warp > 0) {
        // the run continues into the fall section until the glyph 落, then the whole tunnel drops away
        const fallen = s.id === 'fall' && t > FALL_T;
        const drop = fallen ? (t - FALL_T) * (t - FALL_T) * 700 : 0;
        const fade = fallen ? 1 - clamp((t - FALL_T) / 1.1) : 1;
        drawWarp(g, t, s.warp * fadeIn * fade, s.line, (bi.bpm || 145) / 145, drop);
      }
      if (s.ash > 0 && s.id === 'fall' && t > FALL_T + 0.4) drawAsh(g, t, s.ash * clamp((t - FALL_T - 0.4) / 2.5), s.line);
    }

    // ---------------- rain (thin, quiet; frozen during the whisper before the chorus)
    const nRain = Math.round(s.rain * 220);
    const rt = rainClock(t);
    const frozen = rainFrozen(t);
    g.lineCap = 'round';
    for (let i = 0; i < nRain; i++) {
      const d = 0.3 + r(`d${i}`) * 0.7;
      const speed = 700 + 1100 * d;
      const stretch = Math.max(0.12, s.rainSpeed) * (1 - 0.85 * frozen);
      const len = Math.max(5, (24 + 70 * d) * stretch);
      const x0 = r(`x${i}`) * (W + 100) - 50;
      const y = ((rt * speed + r(`y${i}`) * (H + 100)) % (H + 100)) - 50;
      g.strokeStyle = rgba(s.line, (0.05 + 0.16 * d) * (1 + frozen * 0.8));
      g.lineWidth = 0.5 + d;
      g.beginPath();
      g.moveTo(x0 + y * 0.06, y);
      g.lineTo(x0 + (y + len) * 0.06, y + len);
      g.stroke();
    }
    if (phase === 'over') return;

    // ---------------- floating dust
    const nDust = Math.round(s.dust * 70);
    for (let i = 0; i < nDust; i++) {
      const d = r(`pd${i}`);
      const sp = 8 + 22 * d;
      const x = r(`px${i}`) * W + Math.sin(t * 0.15 + i) * 25 * d;
      const y = H + 20 - ((t * sp + r(`py${i}`) * (H + 40)) % (H + 40)) + fallY * (0.5 + d);
      const a = (0.12 + 0.3 * d) * (0.6 + 0.4 * Math.sin(t * 0.6 + i * 1.7));
      g.fillStyle = rgba(s.line, a * 0.22);
      g.beginPath();
      g.arc(x, y, (1 + 2.5 * d) * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(s.line, a);
      g.beginPath();
      g.arc(x, y, 1 + 1.5 * d, 0, Math.PI * 2);
      g.fill();
    }

    // ---------------- top-down ripples where drops land (kept out of the lyric area)
    if (s.ripples !== 'none') {
      const life = 2.4;
      for (const b of beatsInWindow(t, life, s.ripples === 'down')) {
        const age = t - b.t;
        const k = `${b.t.toFixed(3)}`;
        const [cx, cy0] = awayFromCentre((0.06 + r(k + 'x') * 0.88) * W, (0.1 + r(k + 'y') * 0.8) * H);
        const cy = cy0 + fallY;
        const rad = 8 + age * (b.down ? 110 : 75);
        const a = Math.pow(1 - age / life, 1.5) * (b.down ? 0.4 : 0.24);
        g.lineWidth = 1;
        for (let ring = 0; ring < 2; ring++) {
          const rr = rad - ring * 14;
          if (rr <= 0) continue;
          g.strokeStyle = rgba(s.line, a * (1 - ring * 0.45));
          g.beginPath();
          g.arc(cx, cy, rr, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }

    // ---------------- background dice near the edges, slowly drifting and turning
    for (let i = 0; i < s.dice; i++) {
      const k = `${s.id}-die${i}`;
      const side = i % 2 ? 1 : -1;
      const bx = W / 2 + side * W * (0.3 + 0.16 * r(k + 'x'));
      const by = (0.15 + 0.7 * r(k + 'y')) * H;
      const cx = bx + Math.sin(t * 0.06 + i) * 40;
      const rise = s.aurora > 0.5 ? (((t - s.start) * (18 + 20 * r(k + 'u'))) % (H * 1.2)) : 0; // dream: dice float upward
      const cy = by - rise + Math.cos(t * 0.05 + i * 2) * 30 + fallY * (0.8 + r(k + 'f'));
      const size = 20 + r(k + 's') * 34;
      const sp = 0.1 + 0.15 * r(k + 'r');
      drawDie(g, cx, cy, size, mul(Rx(t * sp + i), mul(Ry(t * sp * 0.7 + 2 * i), Rz(t * sp * 0.3))), s.line, 0.28 * fadeIn);
    }

    if (s.glints > 0) drawGlints(g, t, s.glints * fadeIn, s.line);

    // ---------------- pre-chorus dice tower (and its collapse into the chorus)
    if (s.tower || (t >= PRE_END && t < PRE_END + 1.6)) {
      drawTower(g, t, sectionAt(PRE_START).line, '#1b1140');
    }

    // ---------------- chorus: one wide ring from the centre on every downbeat
    if (s.ring) {
      const life = 2.6;
      for (const b of beatsInWindow(t, life, true)) {
        const age = t - b.t;
        const p = eo(clamp(age / life));
        g.strokeStyle = rgba(s.line, 0.5 * Math.pow(1 - age / life, 1.2));
        g.lineWidth = 0.8 + 3.2 * (1 - p);
        g.beginPath();
        g.arc(W / 2, H / 2, 40 + p * W * 0.62, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // ---------------- anamorphic streak across the centre on downbeats
    if (s.streak) {
      for (const b of beatsInWindow(t, 0.7, true)) {
        const a = Math.pow(1 - (t - b.t) / 0.7, 2);
        const sg = g.createLinearGradient(0, 0, W, 0);
        sg.addColorStop(0, rgba(s.line, 0));
        sg.addColorStop(0.5, rgba('#ffffff', 0.85 * a));
        sg.addColorStop(1, rgba(s.line, 0));
        g.fillStyle = sg;
        g.fillRect(0, H / 2 - 1.5, W, 3);
        const sg2 = g.createLinearGradient(0, 0, W, 0);
        sg2.addColorStop(0, rgba(s.line, 0));
        sg2.addColorStop(0.5, rgba(s.line, 0.16 * a));
        sg2.addColorStop(1, rgba(s.line, 0));
        g.fillStyle = sg2;
        g.fillRect(0, H / 2 - 40, W, 80);
      }
    }

    // ---------------- a chorus line cuts in: speed lines burst outward + a flash
    if (s.burst) {
      for (const c of CUTS) {
        const age = t - c;
        if (age < 0 || age > 0.55) continue;
        const k = age / 0.55;
        g.lineWidth = 1.6;
        for (let i = 0; i < 72; i++) {
          const key = `sl${c.toFixed(2)}${i}`;
          const ang = (i / 72) * Math.PI * 2 + r(key) * 0.06;
          const r0 = H * (0.3 + eo(k) * 0.55 + r(key + 'o') * 0.08);
          const r1 = r0 + H * (0.18 + 0.3 * r(key + 'l')) * (1 - k);
          g.strokeStyle = rgba(s.line, 0.55 * (1 - k));
          g.beginPath();
          g.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
          g.lineTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1);
          g.stroke();
        }
        if (age < 0.16) {
          g.fillStyle = `rgba(255,255,255,${0.32 * Math.pow(1 - age / 0.16, 2)})`;
          g.fillRect(0, 0, W, H);
        }
      }
    }

    // ---------------- bubbles (deep): more and faster as the music builds — motion is integrated, never jumps
    if (s.bubbles > 0) {
      const D = s.end - s.start;
      const dt = Math.max(0, t - s.start);
      const u = clamp(dt / D);
      const count = s.bubbles * (25 + 150 * Math.pow(u, 1.4));
      const travel = dt + (2.6 * dt * dt * dt) / (3 * D * D); // ∫ (1 + 2.6 (τ/D)²) dτ
      for (let i = 0; i < Math.ceil(count); i++) {
        const k = `bb${i}`;
        // each bubble has a birth time (the first 25 are spread over the first 2.5 s, later ones are born
        // when the count passes them) and comes into focus from a blur over 1.4 s — nothing pops in
        const birth = i < 25 * s.bubbles ? s.start + 0.3 + r(k + 'b') * 2.5 : s.start + D * Math.pow(Math.max(0, i / s.bubbles - 25) / 150, 1 / 1.4);
        const appear = smooth((t - birth) / 1.4);
        if (appear <= 0) continue;
        const v0 = 45 + 130 * r(k + 'v');
        const sz = (3 + Math.pow(r(k + 'z'), 2) * 26) * (0.75 + 0.25 * appear);
        const y = H + 40 - ((travel * v0 + r(k + 'p') * (H + 80)) % (H + 80));
        const x = r(k + 'x') * W + Math.sin(t * (0.5 + 0.8 * r(k + 'w')) + i * 1.7) * (6 + 12 * r(k + 'a'));
        const a = 0.42 * appear;
        g.filter = appear < 0.999 ? `blur(${((1 - appear) * (4 + sz * 0.5)).toFixed(2)}px)` : 'none';
        g.strokeStyle = rgba(s.line, a);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, sz, 0, Math.PI * 2);
        g.stroke();
        if (sz > 10) {
          g.fillStyle = rgba(s.line, a * 0.12);
          g.fill();
        }
        g.fillStyle = `rgba(255,255,255,${0.35 * appear})`;
        g.beginPath();
        g.arc(x - sz * 0.35, y - sz * 0.35, Math.max(1, sz * 0.18), 0, Math.PI * 2);
        g.fill();
      }
      g.filter = 'none';
    }

    // ---------------- ink clouds creeping in from the edges
    if (s.ink > 0) {
      const p = clamp((t - s.start) / 7) * s.ink;
      g.save();
      g.filter = 'blur(40px)';
      g.fillStyle = 'rgba(2,1,4,0.93)';
      for (let i = 0; i < 14; i++) {
        const k = `ink${i}`;
        const ang = (i / 14) * Math.PI * 2 + r(k) * 0.4;
        const ex = W / 2 + Math.cos(ang) * W * 0.62;
        const ey = H / 2 + Math.sin(ang) * H * 0.68;
        const rad = (0.1 + 0.26 * p) * W * (0.7 + 0.6 * r(k + 's'));
        g.beginPath();
        g.arc(ex + Math.sin(t * 0.12 + i) * 40, ey + Math.cos(t * 0.1 + i) * 30, rad, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }, [t, phase]);

  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />;
};
