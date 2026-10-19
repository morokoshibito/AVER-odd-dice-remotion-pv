import React from 'react';
import {AbsoluteFill} from 'remotion';
import timing from '../data/timing.json';
import {COVER_LINE, CREDITS, FONT_EN, FONT_JP, H, ORIGINAL_ARTIST, PALETTE, TITLE} from '../config';
import {OUTRO_START, SENZA_START} from '../direction';
import {clamp, DURATION, smooth, useT} from '../lib/time';

const vh = (x: number) => (x * H) / 100;

/** Intro title: letters arrive one per downbeat, then the subtitle. */
export const IntroTitle: React.FC = () => {
  const t = useT();
  const START = 3.0;
  const END = 19.6;
  if (t < START - 0.5 || t > END + 1) return null;
  const downs = timing.bars.filter((b) => b.t >= START).map((b) => b.t);
  const letters = TITLE.split('');
  const out = 1 - smooth((t - END) / 0.8);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out}}>
      <div style={{fontFamily: FONT_EN, fontWeight: 300, fontSize: vh(15), color: PALETTE.silver, letterSpacing: '0.04em', textShadow: '0 0 30px rgba(140,120,230,0.5)'}}>
        {letters.map((ch, i) => {
          const at = downs[i] ?? START + i;
          const a = smooth((t - at) / 0.9);
          return (
            <span key={i} style={{display: 'inline-block', opacity: a, filter: `blur(${(1 - a) * 12}px)`, transform: `translateY(${(1 - a) * 12}px)`, whiteSpace: 'pre'}}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{width: vh(55) * smooth((t - 12) / 1.5), height: 1, background: 'rgba(230,230,255,0.7)', margin: `${vh(1.5)}px 0`}} />
      <div style={{fontFamily: FONT_EN, fontWeight: 500, fontSize: vh(4.4), color: PALETTE.silver, opacity: smooth((t - 12.5) / 1.2)}}>{ORIGINAL_ARTIST}</div>
      <div style={{fontFamily: FONT_EN, fontWeight: 500, fontSize: vh(2.9), color: PALETTE.lavender, letterSpacing: '0.2em', marginTop: vh(2), opacity: smooth((t - 14) / 1.2)}}>{COVER_LINE}</div>
    </AbsoluteFill>
  );
};

/** Credits during the outro + final card in the ritardando. */
export const OutroTitles: React.FC = () => {
  const t = useT();
  const span = (SENZA_START - OUTRO_START - 6) / CREDITS.length;
  const credIdx = Math.floor((t - OUTRO_START - 3) / span);
  const cred = CREDITS[credIdx];
  const local = t - OUTRO_START - 3 - credIdx * span;
  const credA = cred ? smooth(local / 0.8) * (1 - smooth((local - span + 0.8) / 0.8)) : 0;

  const finalStart = DURATION - 11;
  const fa = smooth((t - finalStart) / 2) * (1 - smooth((t - (DURATION - 2.5)) / 2));
  return (
    <AbsoluteFill>
      {cred && credA > 0 ? (
        <div style={{
          position: 'absolute', left: '4%', bottom: '7%', opacity: credA, color: PALETTE.silver, textShadow: '0 0 12px rgba(0,0,0,0.9)',
          padding: `${vh(1.6)}px ${vh(3)}px`, background: 'linear-gradient(90deg, rgba(6,3,14,0.78), rgba(6,3,14,0))', // stays readable over the kaleidoscope
        }}>
          <div style={{fontFamily: FONT_EN, fontSize: vh(2.4), letterSpacing: '0.3em', opacity: 0.7}}>{cred.role.toUpperCase()}</div>
          <div style={{fontFamily: FONT_JP, fontSize: vh(4.2), marginTop: vh(0.6)}}>{cred.name}</div>
        </div>
      ) : null}
      {fa > 0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: fa}}>
          <div style={{fontFamily: FONT_EN, fontWeight: 300, fontSize: vh(9), color: PALETTE.silver}}>{TITLE}</div>
          <div style={{fontFamily: FONT_EN, fontWeight: 500, fontSize: vh(2.8), color: PALETTE.lavender, letterSpacing: '0.2em', marginTop: vh(2.4), opacity: clamp(fa)}}>{COVER_LINE}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
