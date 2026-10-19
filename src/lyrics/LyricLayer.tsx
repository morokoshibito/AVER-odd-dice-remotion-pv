import React, {CSSProperties} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {FONT_EN, FONT_JP, H, PALETTE, SHOW_RUBY, SHOW_TRANSLATION, W} from '../config';
import {CHORUS_KIND, ChorusKind, LYRIC_COLOR, sectionAt, WARM} from '../direction';
import {beatInfo, clamp, pulse, useT} from '../lib/time';
import {EXIT, Timed, TIMED, Token, translationFor} from '../lib/lyrics';
import {BLACKOUTS, blackoutAt} from '../scenes/Moments';

/**
 * Lyric design system.
 *  - every glyph appears exactly when it is sung (SVP timing) — nothing is shown early
 *  - FIXED LAYOUT: a line is laid out at its final, centred position from the start and each glyph
 *    appears in its own place. Lines never slide sideways while they grow.
 *  - entrances are in-place gestures chosen from the words (drop, reveal, stamp, turn, nod …)
 *  - lines leave with an exit only when it can finish before the next line; otherwise they
 *    are cut in one frame (and always at a Vox 2 black cut)
 *  - every glyph in a line has the same size
 *  - no jitter: every motion is a single eased move
 */

const eo = Easing.out(Easing.cubic);
const eback = Easing.out(Easing.back(1.6));
const ei = Easing.in(Easing.quad);
const vh = (x: number) => (x * H) / 100;
const PUNCT = new Set(['、', ',', '，', '。', '.']);
const GLOW = `0 0 ${vh(1.6)}px rgba(170,150,255,0.35)`;
const CRIMSON = '#d0244c';

type Ctx = {t: number; p: Timed; exit: number; color: string; instant: boolean};

const font = (size: number, tracking: number, color: string, weight = 400): CSSProperties => ({
  fontFamily: FONT_JP,
  fontWeight: weight,
  fontSize: vh(size),
  letterSpacing: `${tracking}em`,
  color,
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
  textShadow: GLOW,
});

/** colour-plate ghosts (cyan / magenta) converging onto a glyph as it lands */
const ghost = (k: number, size: number, extra = GLOW) => {
  const g = (1 - k) * vh(size) * 0.14;
  const a = 0.85 * (1 - k);
  return a > 0.01 ? `${-g}px 0 0 rgba(80,225,255,${a}), ${g}px 0 0 rgba(255,70,170,${a}), ${extra}` : extra;
};

const Center: React.FC<{y: number; children: React.ReactNode; style?: CSSProperties}> = ({y, children, style}) => (
  <div style={{position: 'absolute', left: '50%', top: `${y * 100}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', ...style}}>
    {children}
  </div>
);

const text = (tok: Token) =>
  tok.r && SHOW_RUBY ? (
    <ruby>
      {tok.s}
      <rt style={{fontSize: '0.34em'}}>{tok.r}</rt>
    </ruby>
  ) : (
    tok.s
  );

const Glyph: React.FC<{tok: Token; style?: CSSProperties; children?: React.ReactNode}> = ({tok, style, children}) =>
  PUNCT.has(tok.s) ? (
    <span style={{display: 'inline-block', width: '0.35em'}} />
  ) : (
    <span style={{display: 'inline-block', position: 'relative', ...style}}>
      {text(tok)}
      {children}
    </span>
  );

/** a glyph assembled from horizontal slices sliding in from alternate sides (k=1: whole) */
const Sliced: React.FC<{tok: Token; k: number; dist: number; n?: number; style?: CSSProperties}> = ({tok, k, dist, n = 4, style}) => (
  <span style={{position: 'relative', display: 'inline-block', ...style}}>
    <span style={{visibility: 'hidden'}}>{text(tok)}</span>
    {Array.from({length: n}).map((_, i) => (
      <span
        key={i}
        style={{
          position: 'absolute', inset: 0,
          clipPath: `inset(${(i / n) * 100 - 0.5}% 0 ${((n - i - 1) / n) * 100 - 0.5}% 0)`,
          transform: `translateX(${(i % 2 ? 1 : -1) * (1 - k) * dist}px)`,
          opacity: clamp(k * 1.6),
        }}
      >
        {text(tok)}
      </span>
    ))}
  </span>
);

const local = (t: number, tok: Token) => (t - tok.t0) * (tok.k ?? 1); // k > 1 only right before a hard cut
const hidden: CSSProperties = {visibility: 'hidden'};
const mask = (img: string): CSSProperties => ({WebkitMaskImage: img, maskImage: img});

/** two rows, split near the middle at a word boundary (or after the first ？) */
const splitRows = (tokens: Token[], at?: (tok: Token) => boolean): [Token[], Token[]] => {
  if (at) {
    const i = tokens.findIndex(at);
    if (i >= 0 && i < tokens.length - 1) return [tokens.slice(0, i + 1), tokens.slice(i + 1)];
  }
  const total = tokens.reduce((s, t) => s + (PUNCT.has(t.s) ? 0 : t.s.length), 0);
  // prefer a word boundary near the middle: before a kanji that follows kana, or after punctuation
  // (悍ましい｜何かが来る, never 悍ましい何｜かが来る)
  const KANJI = /^[㐀-䶿一-鿿々]/;
  const KANA = /[぀-ヿ]$/;
  let best = -1;
  let bestD = total * 0.3;
  let run = 0;
  for (let i = 1; i < tokens.length; i++) {
    run += PUNCT.has(tokens[i - 1].s) ? 0 : tokens[i - 1].s.length;
    const boundary = PUNCT.has(tokens[i - 1].s) || (KANJI.test(tokens[i].s) && KANA.test(tokens[i - 1].s));
    const d = Math.abs(run - total / 2);
    if (boundary && d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  if (best > 0) return [tokens.slice(0, best), tokens.slice(best).filter((t, j) => j > 0 || !PUNCT.has(t.s))];
  let acc = 0;
  for (let i = 0; i < tokens.length; i++) {
    acc += PUNCT.has(tokens[i].s) ? 0 : tokens[i].s.length;
    if (acc >= total / 2) return [tokens.slice(0, i + 1), tokens.slice(i + 1).filter((t, j) => j > 0 || !PUNCT.has(t.s))];
  }
  return [tokens, []];
};

// ================================================================== generic centred row (fixed layout)
type RowProps = {
  c: Ctx; tokens?: Token[]; y?: number; size?: number; tracking?: number; color?: string; weight?: number;
  enter?: (l: number) => number; // entrance progress 0..1
  glyph: (l: number, i: number, tok: Token, a: number) => CSSProperties;
  style?: CSSProperties; glyphChildren?: (l: number, i: number, tok: Token) => React.ReactNode;
  under?: React.ReactNode; // drawn inside the row box, behind the glyphs
};
const defaultEnter = (l: number) => eo(clamp(l / 0.3));
const Row: React.FC<RowProps> = ({c, tokens, y = 0.5, size = 9, tracking = 0.06, color, weight, enter = defaultEnter, glyph, style, glyphChildren, under}) => {
  const toks = tokens ?? c.p.tokens;
  return (
    <Center y={y}>
      <div style={{...font(size, tracking, color ?? c.color, weight), paddingLeft: `${tracking}em`, position: 'relative', ...style}}>
        {under}
        {toks.map((tok, i) => {
          const l = local(c.t, tok);
          return l < 0 ? (
            <Glyph key={i} tok={tok} style={hidden} />
          ) : (
            <Glyph key={i} tok={tok} style={glyph(l, i, tok, enter(l))}>{glyphChildren?.(l, i, tok)}</Glyph>
          );
        })}
      </div>
    </Center>
  );
};

/** a huge outline copy of the glyphs already sung, slowly expanding behind them (same layout) */
const Echo: React.FC<{c: Ctx; tokens: Token[]; size: number; color: string; scale?: number}> = ({c, tokens, size, color, scale = 2.2}) => {
  const first = tokens[0]?.t0 ?? c.p.start;
  const k = eo(clamp((c.t - first) / 0.6));
  const a = 0.15 * k * (1 - c.exit);
  if (a < 0.005) return null;
  return (
    <div style={{position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${scale + 0.08 * Math.min(c.t - first, 4)})`, pointerEvents: 'none'}}>
      <div style={{...font(size, 0.03, 'transparent', 800), paddingLeft: '0.03em', WebkitTextStroke: `1px ${color}`, opacity: a, textShadow: 'none'}}>
        {tokens.map((tok, i) => <Glyph key={i} tok={tok} style={local(c.t, tok) < 0 ? hidden : undefined} />)}
      </div>
    </div>
  );
};

// ================================================================== verse: drops landing on water (with a reflection)
const Rain: React.FC<{c: Ctx; mirror: number; melt: boolean}> = ({c, mirror, melt}) => {
  const size = 7.6;
  const enter = (l: number) => eo(clamp(l / 0.4));
  const glyph = (flip: boolean) => (l: number, i: number, _tok: Token, a: number): CSSProperties => {
    const ex = clamp((c.t - c.p.hideAt - i * 0.035) / 0.45);
    let y = -(1 - a) * vh(3) + ei(ex) * vh(melt ? 6 : 2);
    const sy = melt ? 1 + ex * 1.4 : 1;
    if (flip) y = -y;
    return {
      opacity: a * (1 - ex),
      transform: `translateY(${y}px) scaleY(${sy})`,
      transformOrigin: '50% 0%',
      filter: `blur(${(1 - a) * 6 + ex * 4}px)`,
      textShadow: flip ? GLOW : ghost(eo(clamp(l / 0.3)), size),
    };
  };
  const fade = 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)';
  return (
    <>
      <Row c={c} y={0.46} size={size} enter={enter} glyph={glyph(false)} />
      <Row c={c} y={0.46 + 0.075} size={size} enter={enter} glyph={glyph(true)} style={{transform: 'scaleY(-1)', opacity: mirror, filter: 'blur(1.6px)', ...mask(fade)}} />
    </>
  );
};

// ================================================================== Vox 2: whispered 1–5 (on black)
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
};
const Count: React.FC<{c: Ctx}> = ({c}) => {
  const n = Math.max(1, Math.min(5, parseInt(c.p.text.match(/\d/)?.[0] ?? '1', 10)));
  const l = c.t - c.p.start;
  const draw = eo(clamp(l / 0.12));
  const size = vh(30);
  return (
    <AbsoluteFill>
      <Center y={0.43} style={{transform: `translate(-50%,-50%) scale(${1.12 - 0.12 * draw})`}}>
        <div style={{fontFamily: FONT_EN, fontWeight: 300, fontSize: vh(92), lineHeight: 1, color: 'transparent', WebkitTextStroke: `1.5px rgba(201,194,240,${0.35 * draw})`}}>{n}</div>
      </Center>
      <Center y={0.5}>
        <svg width={size} height={size} viewBox="-50 -50 100 100">
          <rect x={-44} y={-44} width={88} height={88} rx={16} fill="none" stroke="#ffffff" strokeWidth={1.4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          {PIPS[n].map(([x, y], i) => {
            const k = eback(clamp((l - 0.04 - i * 0.025) / 0.14));
            return <circle key={i} cx={x * 22} cy={y * 22} r={8 * Math.max(0, k)} fill="#ffffff" />;
          })}
        </svg>
      </Center>
    </AbsoluteFill>
  );
};

// ================================================================== pre-chorus: vertical columns beside the tower
/** each glyph is revealed from its top edge downwards, like ink running down the column */
const Tower: React.FC<{c: Ctx}> = ({c}) => {
  const next = c.p.nextSame;
  const dim = next && c.t > next.start ? 1 - 0.5 * eo(clamp((c.t - next.start) / 0.5)) : 1;
  const size = 6;
  return (
    <div style={{...font(size, 0.04, c.color), position: 'absolute', writingMode: 'vertical-rl', left: `${(0.85 - c.p.groupIndex * 0.085) * 100}%`, top: '10%', transform: 'translateX(-50%)', opacity: dim}}>
      {c.p.tokens.map((tok, i) => {
        const l = local(c.t, tok);
        if (l < 0) return <Glyph key={i} tok={tok} style={hidden} />;
        const a = eo(clamp(l / 0.45));
        const edge = -20 + a * 150; // % down the glyph where the soft reveal edge sits
        return (
          <Glyph key={i} tok={tok} style={{
            ...mask(`linear-gradient(to bottom, #000 ${edge - 28}%, rgba(0,0,0,0) ${edge}%)`),
            textShadow: `0 0 ${vh(1.4)}px rgba(200,185,255,${0.25 + 0.4 * (1 - a)})`,
          }} />
        );
      })}
    </div>
  );
};

// ================================================================== Vox 2: the whisper before the chorus (on black)
/** both rows are on screen from the first frame of the cut; each glyph brightens when it is sung */
const Freeze: React.FC<{c: Ctx}> = ({c}) => {
  const {p, t} = c;
  if (p.idx !== 0) return null; // the second phrase is drawn together with the first
  const big = p.nextSame?.tokens ?? [];
  const sung = (tok: Token) => {
    const l = t - tok.t0;
    return {lit: l >= 0 ? 1 : 0, flash: l >= 0 ? pulse(l, 0.6) : 0};
  };
  return (
    <>
      <Center y={0.3}>
        <div style={{...font(7.2, 0.22, PALETTE.lavender, 600), paddingLeft: '0.22em'}}>
          {p.tokens.map((tok, i) => {
            const s = sung(tok);
            return <Glyph key={i} tok={tok} style={{opacity: 0.72 + 0.28 * s.lit, color: s.lit ? '#f1ecff' : undefined, textShadow: `0 0 ${vh(1 + 2.5 * s.flash)}px rgba(200,185,255,${0.3 + 0.5 * s.flash})`}} />;
          })}
        </div>
      </Center>
      {big.length ? (
        <Center y={0.6}>
          <div style={{...font(26, 0.02, '#ffffff', 800), paddingLeft: '0.02em'}}>
            {big.map((tok, i) => {
              const s = sung(tok);
              return <Glyph key={i} tok={tok} style={{opacity: 0.8 + 0.2 * s.lit, textShadow: `0 0 ${vh(2 + 5 * s.flash)}px rgba(255,255,255,${0.25 + 0.55 * s.flash})`, filter: `brightness(${1 + 0.5 * s.flash})`}} />;
            })}
          </div>
        </Center>
      ) : null}
    </>
  );
};

// ================================================================== chorus: anchor words + the line as a cut
const Anchor: React.FC<{c: Ctx; tokens: Token[]; still: boolean; warm: boolean}> = ({c, tokens, still, warm}) => {
  const size = 8;
  const step = vh(size) * 1.1;
  return (
    <div style={{...font(size, 0.3, warm ? WARM : PALETTE.lavender, 600), overflow: 'hidden', padding: `${vh(size) * 0.12}px ${vh(size) * 0.1}px ${vh(size) * 0.12}px ${vh(size) * 0.4}px`}}>
      {tokens.map((tok, i) => {
        const l = local(c.t, tok);
        if (!still && l < 0) return <Glyph key={i} tok={tok} style={hidden} />;
        const a = still ? 1 : eo(clamp(l / 0.22));
        return <Glyph key={i} tok={tok} style={{transform: `translateY(${(1 - a) * step}px)`, opacity: clamp(a * 1.4), textShadow: ghost(a, size)}} />;
      })}
    </div>
  );
};

const chorusKind = (tokens: Token[]): ChorusKind => {
  const s = tokens.map((t) => t.s).join('');
  return CHORUS_KIND.find(([key]) => s.includes(key))?.[1] ?? 'smash';
};

/**
 * Each chorus line is a cut; its glyphs land in place at the moment they are sung, with a gesture
 * taken from the line's verb (see CHORUS_KIND in direction.ts).
 */
const ChorusLine: React.FC<{c: Ctx; tokens: Token[]; warm: boolean}> = ({c, tokens, warm}) => {
  const {p, t} = c;
  const size = 15;
  const kind = chorusKind(tokens);
  const color = warm ? WARM : c.color;
  const glow = warm ? `0 0 ${vh(2)}px rgba(255,170,140,0.45), 0 0 ${vh(5)}px rgba(158,27,50,0.3)` : `0 0 ${vh(2.4)}px rgba(205,190,255,0.55)`;
  const first = tokens[0]?.t0 ?? p.start;
  const ex = eo(c.exit);
  const enter = (l: number) => eo(clamp(l / 0.24));
  if (!tokens.length || t < first) return <div style={{...font(size, 0.03, color, 800), visibility: 'hidden'}}>{'　'}</div>;

  if (kind === 'band') {
    const bk = eo(clamp((t - first + 0.04) / 0.18));
    return (
      <div style={{position: 'relative', padding: `0 ${vh(size) * 0.45}px`, opacity: 1 - ex}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: '8%', bottom: '4%', background: 'linear-gradient(90deg, #f6f2ff, #d9cfff)', transform: 'skewX(-14deg)', clipPath: `inset(0 ${(1 - bk) * 100}% 0 0)`, boxShadow: `0 0 ${vh(4)}px rgba(220,205,255,0.55)`}} />
        <div style={{...font(size, 0.03, '#1b0d3c', 800), textShadow: 'none', position: 'relative', paddingLeft: '0.03em'}}>
          {tokens.map((tok, i) => {
            const l = local(t, tok);
            return l < 0 ? <Glyph key={i} tok={tok} style={hidden} /> : <Sliced key={i} tok={tok} k={eo(clamp(l / 0.22))} dist={vh(size) * 0.7} />;
          })}
        </div>
      </div>
    );
  }

  const glyphStyle = (tok: Token, i: number): CSSProperties => {
    const l = local(t, tok);
    const a = enter(l);
    switch (kind) {
      case 'tear': {
        const e = eo(clamp(l / 1.1));
        const trail = `0 ${vh(size) * 0.55 * e}px ${vh(0.9)}px rgba(190,200,255,${0.6 * (1 - e) * clamp(l / 0.12)})`;
        return {transform: `scale(${1.7 - 0.7 * a})`, opacity: clamp(a * 2), filter: `blur(${(1 - a) * 8}px)`, textShadow: `${ghost(a, size * 1.8, glow)}, ${trail}`};
      }
      case 'pop': {
        const b = eback(clamp(l / 0.3));
        return {transform: `scale(${0.35 + 0.65 * b})`, opacity: clamp(l / 0.06), filter: `brightness(${1 + 1.1 * (1 - clamp(l / 0.35))})`, textShadow: ghost(a, size * 1.8, glow)};
      }
      case 'close': {
        const dir = i % 2 ? 1 : -1;
        return {transform: `perspective(${vh(60)}px) translateY(${dir * (1 - a) * vh(size) * 1.2}px) rotateX(${dir * (1 - a) * -75}deg)`, opacity: clamp(a * 1.6), textShadow: ghost(a, size * 1.8, glow)};
      }
      case 'turn':
      case 'turnBack': {
        const k = eo(clamp(l / 0.34));
        const sgn = kind === 'turn' ? -1 : 1;
        const dimmed = kind === 'turnBack' ? 1 - 0.18 * clamp((l - 0.35) / 0.6) : 1;
        return {transform: `perspective(${vh(70)}px) rotateY(${sgn * 180 * (1 - k)}deg)`, opacity: clamp(k * 3) * dimmed, textShadow: ghost(k, size * 1.8, glow)};
      }
      case 'reach':
        return {transform: `scale(${1.5 - 0.5 * a})`, opacity: clamp(a * 2), filter: `blur(${(1 - a) * 8}px)`, textShadow: ghost(a, size * 1.8, glow)};
      case 'nod': {
        const n = Math.sin(Math.PI * clamp(l / 0.5));
        return {transform: `translateY(${n * vh(size) * 0.12}px)`, opacity: clamp(l / 0.08), filter: `blur(${(1 - clamp(l / 0.12)) * 6}px)`, textShadow: ghost(a, size * 1.8, glow)};
      }
      default:
        return {transform: `scale(${2.6 - 1.6 * a})`, opacity: clamp(a * 2), filter: `blur(${(1 - a) * 10}px)`, textShadow: ghost(a, size * 1.8, glow)};
    }
  };

  // 'reach': a hairline of light runs under the glyphs already sung, to the newest one
  let reach: React.ReactNode = null;
  if (kind === 'reach') {
    const em = tokens.reduce((s, tok) => s + (local(t, tok) < 0 ? 0 : (PUNCT.has(tok.s) ? 0.35 : tok.s.length * 1.03) * eo(clamp(local(t, tok) / 0.3))), 0);
    reach = <div style={{position: 'absolute', left: '0.03em', bottom: '0.06em', height: Math.max(2, vh(0.45)), width: `${em}em`, background: `linear-gradient(90deg, rgba(255,255,255,0.15), ${color})`, boxShadow: `0 0 ${vh(1.5)}px rgba(220,205,255,0.8)`}} />;
  }

  return (
    <div style={{position: 'relative', opacity: 1 - ex, transform: `scale(${1 + 0.6 * ex})`}}>
      {kind === 'smash' || kind === 'tear' || kind === 'pop' ? <Echo c={c} tokens={tokens} size={size} color={color} scale={2.3} /> : null}
      <div style={{...font(size, 0.03, color, 800), paddingLeft: '0.03em', position: 'relative'}}>
        {reach}
        {tokens.map((tok, i) => (local(t, tok) < 0 ? <Glyph key={i} tok={tok} style={hidden} /> : <Glyph key={i} tok={tok} style={glyphStyle(tok, i)} />))}
      </div>
    </div>
  );
};

const Roll: React.FC<{c: Ctx}> = ({c}) => {
  const {p} = c;
  const warm = p.style === 'rollYou';
  const anchorTokens = p.tokens.slice(0, p.prefix);
  const restTokens = p.tokens.slice(p.prefix);
  const anchorStill = !!p.prevSame && p.prevSame.anchor === p.anchor;
  return (
    <Center y={0.5}>
      {anchorTokens.length ? <div style={{marginBottom: -vh(1.2)}}><Anchor c={c} tokens={anchorTokens} still={anchorStill} warm={warm} /></div> : null}
      <ChorusLine c={c} tokens={restTokens} warm={warm} />
    </Center>
  );
};

// ================================================================== C: dream → dread → monster → run → fall
const Dream: React.FC<{c: Ctx}> = ({c}) => (
  <Row c={c} size={9.5} tracking={0.1} enter={(l) => eo(clamp(l / 0.7))} glyph={(_l, i, _t, a) => {
    const ex = clamp((c.t - c.p.hideAt - i * 0.04) / 0.5);
    return {
      opacity: a * (1 - ex),
      filter: `blur(${(1 - a) * 12 + ex * 10}px)`,
      transform: `translateY(${-ex * vh(3)}px) scale(${1.1 - 0.1 * a})`,
      textShadow: `0 0 ${vh(3)}px rgba(210,170,255,0.65), 0 0 ${vh(0.6)}px rgba(255,255,255,0.6)`,
    };
  }} />
);

/** no hesitation to destroy: ink-bled glyphs; 壊 and 崩 land cracked and stay cracked */
const BROKEN = /[壊崩]/;
const Dread: React.FC<{c: Ctx}> = ({c}) => {
  const size = 8.6;
  return (
    <Center y={0.5}>
      <div style={{...font(size, 0.05, c.color), paddingLeft: '0.05em', filter: 'url(#inkText)'}}>
        {c.p.tokens.map((tok, i) => {
          const l = local(c.t, tok);
          if (l < 0) return <Glyph key={i} tok={tok} style={hidden} />;
          const a = eo(clamp(l / 0.3));
          const ex = clamp((c.t - c.p.hideAt - i * 0.03) / 0.5);
          const shadow = ghost(eo(clamp(l / 0.3)), size, `0 0 ${vh(2)}px rgba(208,36,76,0.65)`);
          const base: CSSProperties = {opacity: clamp(a * 1.3) * (1 - ex), transform: `scale(${1.25 - 0.25 * a}) translateY(${ei(ex) * vh(5)}px)`, filter: `blur(${(1 - a) * 6 + ex * 6}px)`, textShadow: shadow};
          if (BROKEN.test(tok.s)) {
            // slices slam together but stop short: the crack stays
            const k = 0.86 * eo(clamp(l / 0.22));
            return <Sliced key={i} tok={tok} k={k} dist={vh(size) * 0.45} n={5} style={{...base, color: '#ffd9e2'}} />;
          }
          return <Glyph key={i} tok={tok} style={base} />;
        })}
      </div>
    </Center>
  );
};

/** something terrible comes: two giant rows, centred, dark glyphs with a crimson edge, slicing in */
const Monster: React.FC<{c: Ctx}> = ({c}) => {
  const [a, b] = splitRows(c.p.tokens);
  const bi = beatInfo(c.t);
  const throb = bi.beat?.down ? pulse(bi.sinceBeat, 0.3) : 0;
  const size = 16;
  const style: CSSProperties = {
    WebkitTextStroke: `2px ${CRIMSON}`,
    textShadow: `0 0 ${vh(2 + 3 * throb)}px rgba(208,36,76,${0.55 + 0.35 * throb})`,
  };
  const sliced = (toks: Token[], y: number) => (
    <Center y={y}>
      <div style={{...font(size, 0.02, 'rgba(14,4,9,0.92)', 800), ...style, paddingLeft: '0.02em'}}>
        {toks.map((tok, i) => {
          const l = local(c.t, tok);
          return l < 0 ? <Glyph key={i} tok={tok} style={hidden} /> : <Sliced key={i} tok={tok} k={eo(clamp(l / 0.3))} dist={vh(size) * 0.6} n={5} />;
        })}
      </div>
    </Center>
  );
  return (
    <>
      {sliced(a, 0.37)}
      {b.length ? sliced(b, 0.63) : null}
    </>
  );
};

/** running on regardless: each glyph is a footstep — stamped down in place, leaning forward, a mark under it */
const Run: React.FC<{c: Ctx}> = ({c}) => {
  const size = 10;
  return (
    <Row c={c} size={size} tracking={0.06} weight={800} color="#ffffff" enter={(l) => eo(clamp(l / 0.12))} glyph={(l, i, _t, a) => {
      const ex = clamp((c.t - c.p.hideAt - i * 0.02) / 0.35);
      const lean = 1 - eo(clamp(l / 0.35));
      return {
        opacity: clamp(a * 2) * (1 - ex),
        transform: `translateY(${-(1 - a) * vh(size) * 0.22}px) skewX(${lean * -14}deg)`,
        textShadow: `${-vh(size) * 0.35 * lean}px 0 ${vh(0.8)}px rgba(255,255,255,${0.4 * lean}), ${GLOW}`,
        filter: `blur(${ex * 6}px)`,
      };
    }} glyphChildren={(l) => (
      <span style={{position: 'absolute', left: '12%', right: '12%', bottom: '-0.04em', height: Math.max(2, vh(0.35)), background: '#ffffff', opacity: 0.85 * pulse(l, 0.25), boxShadow: '0 0 10px rgba(220,210,255,0.9)', transform: `scaleX(${0.4 + 0.6 * eo(clamp(l / 0.15))})`}} />
    )} />
  );
};

/** the fall: two rows, fall with everything at 落, then the last words alone, big, centred */
const Fall: React.FC<{c: Ctx}> = ({c}) => {
  const {p, t} = c;
  const fi = p.tokens.findIndex((tok) => tok.s.includes('落'));
  if (fi < 0) return <Row c={c} glyph={(_l, _i, _t, a) => ({opacity: a})} />;
  const endFall = Math.min(p.tokens.length, fi + 3); // 落 ち た 、
  const rowB0 = Math.max(0, fi - 2); // the two tokens before 落 open the second row
  const rowA = p.tokens.slice(0, rowB0);
  const rowB = p.tokens.slice(rowB0, endFall);
  const tail = p.tokens.slice(endFall).filter((tok) => !PUNCT.has(tok.s));
  const fallT = p.tokens[Math.min(p.tokens.length - 1, fi + 2)].t1;
  const d = Math.max(0, t - fallT);
  const falling: CSSProperties = {opacity: 1 - clamp(d / 1.0)};
  const enter = (l: number) => eo(clamp(l / 0.3));
  const g = (l: number, _i: number, _t: Token, a: number): CSSProperties => ({opacity: clamp(a * 1.5), transform: `translateY(${(1 - a) * vh(2)}px)`, filter: `blur(${(1 - a) * 6}px)`, textShadow: ghost(eo(clamp(l / 0.3)), 9)});
  return (
    <>
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${d * d * vh(70)}px) rotate(${d * 6}deg)`, ...falling}}>
        <Row c={c} tokens={rowA} y={0.38} size={9} tracking={0.04} enter={enter} glyph={g} />
        <Row c={c} tokens={rowB} y={0.54} size={9} tracking={0.04} enter={enter} glyph={g} />
      </div>
      {tail.length ? (
        <Row c={c} tokens={tail} y={0.5} size={13} tracking={0.16} color="#ece8ff" enter={(l) => eo(clamp(l / 0.7))} glyph={(_l, _i, _t, a) => ({
          opacity: a * (1 - c.exit),
          filter: `blur(${(1 - a) * 14 + c.exit * 8}px)`,
          transform: `scale(${1.08 - 0.08 * a})`,
          textShadow: `0 0 ${vh(3)}px rgba(200,190,255,0.5)`,
        })} />
      ) : null}
    </>
  );
};

// ================================================================== deep water
/** fading like foam: each glyph swells out of a point like a bubble; the line floats up when it leaves */
const Water: React.FC<{c: Ctx}> = ({c}) => (
  <Row c={c} size={9} tracking={0.06} color="#eef6ff" enter={(l) => eo(clamp(l / 0.45))} glyph={(_l, i, _t, a) => {
    const ex = clamp((c.t - c.p.hideAt - i * 0.04) / 0.6);
    const r = 15 + a * 95;
    return {
      opacity: clamp(a * 1.4) * (1 - ex),
      transform: `translateY(${(1 - a) * vh(1.5) - ei(ex) * vh(10)}px)`,
      filter: `blur(${(1 - a) * 6 + ex * 10}px)`,
      textShadow: `0 0 ${vh(2)}px rgba(160,210,255,0.55)`,
      ...mask(`radial-gradient(circle at 50% 55%, #000 ${r - 15}%, rgba(0,0,0,0) ${r}%)`),
    };
  }} />
);

const mixHex = (a: [number, number, number], b: [number, number, number], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const Bleed: React.FC<{c: Ctx}> = ({c}) => (
  <Row c={c} size={9} tracking={0.06} enter={(l) => eo(clamp(l / 0.25))} glyph={(l, _i, _t, a) => {
    const b = eo(clamp((l - 0.15) / 0.9)); // white → blood
    return {
      opacity: a * (1 - c.exit),
      color: mixHex([238, 246, 255], [214, 40, 72], b),
      filter: `blur(${(1 - a) * 6 + c.exit * 8}px)`,
      textShadow: `0 0 ${vh(0.5 + 3 * b)}px rgba(214,40,72,${0.2 + 0.6 * b}), 0 ${vh(1.2 * b)}px ${vh(2 * b)}px rgba(214,40,72,${0.4 * b})`,
    };
  }} />
);

const Strike: React.FC<{c: Ctx}> = ({c}) => (
  <Row c={c} size={8.6} tracking={0.06} enter={(l) => eo(clamp(l / 0.07))} glyph={(l, _i, _t, a) => ({
    opacity: clamp(a * 1.5) * (1 - 0.3 * clamp((l - 0.35) / 0.3)) * (1 - c.exit),
    textShadow: ghost(a, 8.6),
  })} glyphChildren={(l) => (
    <span style={{position: 'absolute', left: '-0.05em', top: '52%', height: Math.max(2, vh(0.35)), width: `${clamp((l - 0.15) / 0.1) * 110}%`, background: '#ffffff', boxShadow: '0 0 8px rgba(255,255,255,0.8)'}} />
  )} />
);

const Question: React.FC<{c: Ctx}> = ({c}) => {
  const [a, b] = splitRows(c.p.tokens, (tok) => tok.s.includes('？') || tok.s.includes('?'));
  const enter = (l: number) => eo(clamp(l / 0.1));
  const g = (l: number, _i: number, tok: Token, k: number): CSSProperties => {
    const q = tok.s.includes('？') || tok.s.includes('?');
    return {opacity: clamp(l / 0.04) * (1 - c.exit), transform: `scale(${(q ? 1.35 : 1) * (1.4 - 0.4 * k)})`, filter: `blur(${(1 - k) * 4}px)`, color: q ? '#ffc2d2' : undefined, textShadow: ghost(eo(clamp(l / 0.2)), 9)};
  };
  return (
    <>
      <Row c={c} tokens={a} y={0.4} size={9} tracking={0.05} enter={enter} glyph={g} />
      {b.length ? <Row c={c} tokens={b} y={0.6} size={9} tracking={0.05} enter={enter} glyph={g} /> : null}
    </>
  );
};

/**
 * 嘯いた顔忘れられない — a face you can't forget: each glyph is branded onto the screen in its place.
 * It is pressed in (no blur, readable from the first frame), white-hot, and cools over ~1 s.
 */
const Brand: React.FC<{c: Ctx}> = ({c}) => {
  const size = 10.5;
  return (
    <Row c={c} size={size} tracking={0.05} weight={800} color="#ffffff" enter={(l) => eo(clamp(l / 0.1))} glyph={(l, _i, _t, a) => {
      const heat = Math.exp(-l / 0.45);
      return {
        opacity: clamp(l / 0.03),
        transform: `scale(${1.16 - 0.16 * a})`,
        color: mixHex([255, 244, 226], [244, 240, 255], 1 - heat),
        textShadow: [
          `0 0 ${vh(0.5)}px rgba(255,236,200,${0.9 * heat})`,
          `0 0 ${vh(2.2)}px rgba(255,120,70,${0.75 * heat})`,
          `0 0 ${vh(5)}px rgba(214,40,72,${0.45 * heat})`,
          `0 0 ${vh(2.2)}px rgba(170,200,255,${0.45 * (1 - heat)})`,
        ].join(', '),
      };
    }} />
  );
};

/**
 * (ここで生きていてよ) — please, live here. Alone on black: each glyph is lit like a small flame,
 * opening from its centre; once the line is complete it breathes, slowly, like a heartbeat;
 * it leaves by glowing out rather than breaking.
 */
const Plea: React.FC<{c: Ctx}> = ({c}) => {
  const {p, t} = c;
  const size = 10.5;
  const first = p.tokens[0]?.t0 ?? p.start;
  const last = p.tokens[p.tokens.length - 1]?.t0 ?? p.end;
  const lit = clamp((t - first) / Math.max(0.5, last + 0.5 - first));
  const beat = t > last + 0.4 ? 0.5 - 0.5 * Math.cos(((t - last - 0.4) / 0.95) * Math.PI * 2) : 0;
  const ex = eo(c.exit);
  return (
    <>
      <div style={{position: 'absolute', left: '50%', top: '50%', width: vh(120), height: vh(46), transform: `translate(-50%,-50%) scale(${1 + 0.4 * ex})`, background: 'radial-gradient(ellipse at center, rgba(255,214,180,0.16), rgba(255,170,140,0.05) 45%, rgba(0,0,0,0) 70%)', opacity: (0.35 + 0.65 * lit) * (0.85 + 0.15 * beat) * (1 - ex)}} />
      <Row c={c} size={size} tracking={0.14} color="#fff3e8" enter={(l) => eo(clamp(l / 0.55))} glyph={(l, _i, _t, a) => {
        const r = 8 + a * 100;
        const ember = Math.exp(-l / 0.5);
        return {
          ...mask(`radial-gradient(circle at 50% 50%, #000 ${r - 12}%, rgba(0,0,0,0) ${r}%)`),
          opacity: 1 - ex,
          filter: `brightness(${1 + 0.6 * ember + 0.25 * beat + 0.8 * ex}) blur(${ex * 5}px)`,
          textShadow: `0 0 ${vh(1.2 + 1.5 * beat)}px rgba(255,236,214,${0.55 + 0.25 * beat}), 0 0 ${vh(4 + 3 * beat)}px rgba(255,170,140,${0.25 + 0.3 * ember + 0.15 * beat})`,
        };
      }} />
    </>
  );
};

// ================================================================== dispatcher
const renderPhrase = (c: Ctx): React.ReactNode => {
  const {p, t} = c;
  switch (p.style) {
    case 'rain':
      return <Rain c={c} mirror={0.18} melt={false} />;
    case 'rainMirror':
      return <Rain c={c} mirror={0.36} melt={false} />;
    case 'drip':
      return <Rain c={c} mirror={0.18} melt />;
    case 'count':
      return <Count c={c} />;
    case 'tower':
      return <Tower c={c} />;
    case 'freeze':
      return <Freeze c={c} />;
    case 'roll':
    case 'rollYou':
      return <Roll c={c} />;
    case 'you':
      return (
        <Row c={c} size={10} color={WARM} enter={(l) => eo(clamp(l / 0.35))} glyph={(l, _i, _t, a) => ({
          opacity: clamp(a * 1.3) * (1 - c.exit), transform: `scale(${1.5 - 0.5 * a})`, filter: `blur(${(1 - a) * 8 + c.exit * 8}px)`,
          textShadow: ghost(eo(clamp(l / 0.3)), 10, `0 0 ${vh(2)}px rgba(255,170,140,0.45), 0 0 ${vh(5)}px rgba(158,27,50,0.3)`),
        })} />
      );
    case 'dream':
      return <Dream c={c} />;
    case 'dread':
      return <Dread c={c} />;
    case 'monster':
      return <Monster c={c} />;
    case 'run':
      return <Run c={c} />;
    case 'fall':
      return <Fall c={c} />;
    case 'water':
      return <Water c={c} />;
    case 'bleed':
      return <Bleed c={c} />;
    case 'strike':
      return <Strike c={c} />;
    case 'question':
      return <Question c={c} />;
    case 'surge':
      return <Brand c={c} />;
    case 'hero':
      return <Plea c={c} />;
    case 'final': {
      const body = p.tokens.slice(0, -1);
      const lastTok = p.tokens[p.tokens.length - 1];
      const zoom = 1 + eo(c.exit) * 0.5;
      const lk = clamp(local(t, lastTok) / 0.35);
      return (
        <AbsoluteFill style={{transform: `scale(${zoom})`, opacity: 1 - c.exit}}>
          <Row c={c} tokens={body} y={0.42} size={7} tracking={0.1} color={WARM} enter={(l) => eo(clamp(l / 0.4))} glyph={(l, _i, _t, a) => ({
            opacity: a, filter: `blur(${(1 - a) * 8}px)`, textShadow: ghost(eo(clamp(l / 0.3)), 7, `0 0 ${vh(2)}px rgba(255,170,140,0.35)`),
          })} />
          {local(t, lastTok) >= 0 ? (
            <Center y={0.66}>
              <div style={{...font(20, 0, '#ffffff', 600), transform: `scale(${1.6 - 0.6 * eo(lk)})`, opacity: clamp(lk * 1.5), filter: `blur(${(1 - eo(lk)) * 10}px)`, textShadow: ghost(eo(lk), 20, `0 0 ${vh(4)}px rgba(255,255,255,0.45)`)}}>
                {text(lastTok)}
              </div>
            </Center>
          ) : null}
        </AbsoluteFill>
      );
    }
    case 'whisper':
      return <Row c={c} y={0.3} size={3.6} tracking={0.5} color={PALETTE.lavender} glyph={(_l, _i, _t, a) => ({opacity: a * (1 - c.exit)})} />;
    default:
      return <Row c={c} glyph={(_l, _i, _t, a) => ({opacity: a * (1 - c.exit), filter: `blur(${(1 - a) * 8 + c.exit * 8}px)`})} />;
  }
};

export const LyricLayer: React.FC = () => {
  const t = useT();
  void blackoutAt;
  const visible = TIMED.filter((p) => {
    if (t < p.start - 0.05) return false;
    if (p.instant) return t < p.hideAt;
    return t <= p.hideAt + (EXIT[p.style] ?? 0.35);
  });
  const cur = [...visible].reverse().find((p) => !p.whisper && t >= p.start && t <= p.hideAt);
  const trans = SHOW_TRANSLATION && cur ? translationFor(cur.line) : '';
  return (
    <AbsoluteFill style={{width: W, height: H}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="inkText">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={8} />
        </filter>
      </svg>
      {visible.map((p) => {
        if (p.style === 'tower' && t >= BLACKOUTS[1][0]) return null; // the tower's words belong to the colour world
        const exitDur = p.instant ? 0 : EXIT[p.style] ?? 0.35;
        const exit = exitDur === 0 ? 0 : clamp((t - p.hideAt) / exitDur);
        const color = LYRIC_COLOR[sectionAt(p.start).id] ?? PALETTE.silver;
        return <React.Fragment key={p.id}>{renderPhrase({t, p, exit, color, instant: p.instant})}</React.Fragment>;
      })}
      {trans ? <div style={{position: 'absolute', left: 0, right: 0, bottom: '6%', textAlign: 'center', ...font(2.4, 0.16, 'rgba(235,232,255,0.8)')}}>{trans}</div> : null}
    </AbsoluteFill>
  );
};
