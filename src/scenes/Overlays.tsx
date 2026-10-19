import React from 'react';
import {AbsoluteFill} from 'remotion';
import {sectionAt} from '../direction';
import {beatInfo, pulse, useT} from '../lib/time';

/**
 * Finishing layer: soft brightness lift on downbeats (nothing moves), vignette,
 * and a fixed film grain (the grain pattern does not change per frame, so it never flickers).
 */
export const Finish: React.FC = () => {
  const t = useT();
  const s = sectionAt(t);
  const bi = beatInfo(t);
  const lift = s.flash * (bi.beat?.down ? 1 : 0) * pulse(bi.sinceBeat, 0.18);
  return (
    <>
      {lift > 0.005 ? <AbsoluteFill style={{background: '#ffffff', opacity: lift * 0.5, mixBlendMode: 'soft-light'}} /> : null}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(3,2,10,0.6) 100%)'}} />
      <AbsoluteFill style={{opacity: 0.05, mixBlendMode: 'overlay'}}>
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
    </>
  );
};
