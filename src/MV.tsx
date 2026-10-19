import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import settings from './render-settings.json';
import {LyricLayer} from './lyrics/LyricLayer';
import {Atmos} from './scenes/Atmos';
import {Backdrop} from './scenes/Backdrop';
import {GeoOutro} from './scenes/GeoOutro';
import {Moments} from './scenes/Moments';
import {Finish} from './scenes/Overlays';
import {Tension} from './scenes/Tension';
import {IntroTitle, OutroTitles} from './scenes/Titles';

const AUDIO_PUBLIC = (settings as {audioPublic?: string | null}).audioPublic ?? null;

/**
 * Abstract 2D motion graphics + kinetic lyrics. No illustrations, no camera shake
 * (single exception: 嘯いた顔忘れられない trembles with a red/green split — see scenes/Tension.tsx).
 * Audio: if your mix is inside public/ it plays here (sound in Studio, included in renders);
 * otherwise the video renders silent and scripts/mux_audio.py adds it afterwards.
 * Layer order (bottom → top):
 *   section backdrop → atmosphere (bokeh, rain, dust, ripples, dice, tower, rings, bubbles, ink)
 *   → Vox 2 moments (veils, hairline, drop & rings) → outro kaleidoscope → suspended rain
 *   → lyrics → titles → finish
 */
export const MV: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    {AUDIO_PUBLIC ? <Audio src={staticFile(AUDIO_PUBLIC)} /> : null}
    <Tension>
      <Backdrop />
      <Atmos phase="main" />
      <Moments />
      <GeoOutro />
      <Atmos phase="over" />
      <LyricLayer />
    </Tension>
    <IntroTitle />
    <OutroTitles />
    <Finish />
  </AbsoluteFill>
);
