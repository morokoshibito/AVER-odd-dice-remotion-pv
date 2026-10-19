import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H} from '../config';
import {TIMED} from '../lib/lyrics';
import {beatInfo, clamp, pulse, smooth, useT} from '../lib/time';

/**
 * 嘯いた顔忘れられない (2:22–2:24) — the only place in the PV where the screen trembles: everything
 * under the titles shakes in small, fast, irregular jolts (harder on each beat) and the picture splits
 * into red and green fringes. It builds through the line and stops dead at the black cut.
 * The line is found by its lyric style ('surge'); change TENSION_STYLE to move the effect.
 */
const TENSION_STYLE = 'surge';
const vh = (x: number) => (x * H) / 100;
const hash = (x: number) => {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const span = (() => {
  const p = TIMED.find((q) => q.style === TENSION_STYLE);
  return p ? [p.start, p.hideAt] : null;
})();

/** 0 outside the line; inside it rises in 0.15 s, then builds from 0.6 to 1 */
const amountAt = (t: number) => {
  if (!span || t < span[0] || t >= span[1]) return 0;
  const k = clamp((t - span[0]) / (span[1] - span[0]));
  return smooth((t - span[0]) / 0.15) * (0.6 + 0.4 * k);
};

export const Tension: React.FC<{children: React.ReactNode}> = ({children}) => {
  const t = useT();
  const amt = amountAt(t);
  const f = Math.round(t * 30);
  const kick = amt > 0 ? pulse(beatInfo(t).sinceBeat, 0.09) : 0;
  const a = vh(0.35 + 0.45 * amt) * amt + vh(0.7) * kick * amt;
  const jx = (hash(f * 1.37) - 0.5) * 2 * a;
  const jy = (hash(f * 2.71 + 5) - 0.5) * 2 * a;
  const rot = (hash(f * 3.3 + 9) - 0.5) * 0.35 * amt;
  const dx = (vh(0.35) + vh(0.9) * amt + vh(0.9) * kick) * amt; // red → right, green → left
  return (
    <>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="rgSplit" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={dx} dy={0} result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feOffset in="g" dx={-dx} dy={0} result="g2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feComposite in="r2" in2="g2" operator="arithmetic" k1={0} k2={1} k3={1} k4={0} result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k1={0} k2={1} k3={1} k4={0} />
        </filter>
      </svg>
      <AbsoluteFill
        style={
          amt > 0
            ? {transform: `translate(${jx}px, ${jy}px) rotate(${rot}deg) scale(1.035)`, filter: 'url(#rgSplit)'}
            : undefined
        }
      >
        {children}
      </AbsoluteFill>
    </>
  );
};
