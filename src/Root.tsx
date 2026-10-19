import React from 'react';
import {Composition} from 'remotion';
import {AUDIO_START_OFFSET_SEC, FPS, H, W} from './config';
import {DURATION} from './lib/time';
import {MV} from './MV';

export const Root: React.FC = () => (
  <>
    <Composition
      id="MV"
      component={MV}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={Math.ceil((DURATION + Math.max(0, AUDIO_START_OFFSET_SEC)) * FPS)}
    />
  </>
);
