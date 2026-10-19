import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {Section, SECTIONS, sectionAt} from '../direction';
import {clamp, useT} from '../lib/time';
import {TIMED} from '../lib/lyrics';

/**
 * Section backgrounds.
 *   enter 'fade' : 1 s cross-fade        enter 'iris' : the new colour opens as a circle from the centre
 *   enter 'cut'  : instant
 * Sections with bgAlt flip between two tones on every new lyric phrase, also as a circle
 * opening from the centre — the colour change lands with the words, never on its own.
 */
const grad = (c: [string, string]) => `linear-gradient(180deg, ${c[0]} 0%, ${c[1]} 100%)`;
const eo = Easing.out(Easing.cubic);
const IRIS = 0.7; // seconds

const flipsOf = (s: Section) =>
  TIMED.filter((p) => !p.whisper && p.start > s.start + 0.5 && p.start < s.end).map((p) => p.start).sort((a, b) => a - b);
const FLIPS = new Map(SECTIONS.map((s) => [s.id, s.bgAlt ? flipsOf(s) : []]));

const Iris: React.FC<{k: number; children: React.ReactNode}> = ({k, children}) => (
  <AbsoluteFill style={{clipPath: `circle(${eo(clamp(k)) * 76}% at 50% 50%)`}}>{children}</AbsoluteFill>
);

const Layer: React.FC<{s: Section; t: number}> = ({s, t}) => {
  if (!s.bgAlt) return <AbsoluteFill style={{background: grad(s.bg)}} />;
  const flips = FLIPS.get(s.id) ?? [];
  let n = 0;
  while (n < flips.length && flips[n] <= t) n++;
  const cur = n % 2 ? s.bgAlt : s.bg;
  const prev = n % 2 ? s.bg : s.bgAlt;
  const k = n > 0 ? (t - flips[n - 1]) / IRIS : 1;
  return (
    <AbsoluteFill>
      {k < 1 ? <AbsoluteFill style={{background: grad(prev)}} /> : null}
      {k < 1 ? <Iris k={k}><AbsoluteFill style={{background: grad(cur)}} /></Iris> : <AbsoluteFill style={{background: grad(cur)}} />}
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC = () => {
  const t = useT();
  const cur = sectionAt(t);
  const prev = SECTIONS[SECTIONS.indexOf(cur) - 1];
  const since = t - cur.start;
  if (!prev || cur.enter === 'cut') return <Layer s={cur} t={t} />;
  if (cur.enter === 'iris' && since < IRIS) {
    return (
      <AbsoluteFill>
        <Layer s={prev} t={t} />
        <Iris k={since / IRIS}><Layer s={cur} t={t} /></Iris>
      </AbsoluteFill>
    );
  }
  const k = clamp(since / 1.0);
  return (
    <AbsoluteFill>
      {k < 1 ? <Layer s={prev} t={t} /> : null}
      <AbsoluteFill style={{opacity: k}}>
        <Layer s={cur} t={t} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
