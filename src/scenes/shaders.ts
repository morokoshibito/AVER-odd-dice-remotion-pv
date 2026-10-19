export const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Outro — one continuous, layered psychedelic kaleidoscope (no camera shake, no hard changes:
 * every change is a morph over a short transition).
 *   layer 1  liquid: double domain-warped fbm in a purple-led palette, warped harder by the bass
 *   layer 2  crystal: a kaleidoscopic IFS fractal (7 folds) drawn as glowing edges + orbit-trap colour
 *   layer 3  tunnel: log-polar stream of die faces (odd pips) flowing out of the centre
 *   layer 4  a ring per beat (fades in, never pops)
 *   post     per-channel chromatic split, beat swells, vignette
 * Symmetry: the mirror count morphs from uSegA to uSegB as uSegK goes 0 → 1 (fold angles are
 * interpolated, so the image changes continuously). Rotation is one direction for the whole take.
 * Ending: uWarp twists and smears the image further and further (never back) until nothing of the
 * kaleidoscope is recognisable, while uDiss eats it away from inside, leaving a faint glowing edge.
 */
export const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uClock, uRot, uSegA, uSegB, uSegK, uMix, uBeat, uDown, uHigh, uBass, uHue, uFade, uInt, uBar, uWarp, uDiss;
uniform float uRings[6];

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a*noise(p); p = m*p*2.03 + 1.7; a *= 0.5; }
  return v;
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// purple-led palette: magenta → violet → cyan → mauve, never green (blue channel never drops below .55)
vec3 pal(float t){ float x = 6.2831853*(t + uHue); return vec3(0.56 + 0.44*cos(x), 0.36 + 0.36*cos(x + 3.14159), 0.8 + 0.25*cos(x + 4.712389)); }
vec3 pal2(float t){ return vec3(0.55, 0.35, 0.75) + vec3(0.45, 0.4, 0.3)*cos(6.2831853*(t*vec3(1.0, 0.9, 1.1) + vec3(0.62, 0.15, 0.85) + uHue*0.5)); }

float fold(float a, float seg){
  float s = 6.2831853 / max(seg, 1.0);
  a = mod(a, s);
  return abs(a - 0.5*s);
}
// mirror count morphs A → B: the folded angles are blended, the radius is kept
vec2 kaleido(vec2 p){
  float r = length(p);
  float a = atan(p.y, p.x) + uRot;
  float f = mix(fold(a, uSegA), fold(a, uSegB), uSegK);
  return vec2(cos(f), sin(f)) * r;
}
vec2 field(vec2 p){
  return vec2(fbm(p + vec2(0.0, uClock*0.07)), fbm(p + vec2(5.2, 1.3) - uClock*0.06)) - 0.5;
}

float pips(vec2 c, float n){
  float d = 1e3;
  if (n < 1.5 || n > 2.5) d = length(c);
  if (n > 1.5) d = min(d, min(length(c - vec2(-0.22,-0.22)), length(c - vec2(0.22,0.22))));
  if (n > 3.5) d = min(d, min(length(c - vec2(0.22,-0.22)), length(c - vec2(-0.22,0.22))));
  return d;
}

vec3 scene(vec2 uv){
  vec2 p = uv;
  if (uWarp > 0.001) {
    // the ending: a twist that grows from the centre plus a large, slow smear
    float r0 = length(p);
    p = rot(uWarp * 7.0 * exp(-r0 * 1.4)) * p;
    p += uWarp * 1.7 * field(p * 0.9);
  }
  vec2 q = kaleido(p);
  if (uWarp > 0.001) q += uWarp * uWarp * 1.3 * field(q * 1.8 + 3.0);
  q *= 1.0 + 0.12*sin(uTime*0.37);
  float r = length(q);
  float ang = atan(q.y, q.x);

  // ---- layer 1: liquid
  vec2 w = q*1.7;
  vec2 o = vec2(fbm(w + vec2(0.0, uTime*0.17)), fbm(w + vec2(3.1, 1.7) - uTime*0.15));
  vec2 o2 = vec2(fbm(w + 2.5*o + vec2(1.7, 9.2) + uTime*0.1), fbm(w + 2.5*o + vec2(8.3, 2.8) - uTime*0.12));
  float f = fbm(w + (2.2 + 3.5*uBass*uInt)*o2);
  vec3 col = pal(f*1.9 + length(o)*0.6 + uTime*0.06) * (0.18 + 0.9*f*f);
  col *= 0.45 + 0.55*uInt;

  // ---- layer 2: KIFS crystal
  float kw = smoothstep(0.12, 0.55, uInt);
  if (kw > 0.001) {
    vec2 c = q * (1.5 + 0.35*sin(uTime*0.23));
    float sc = 1.0, edge = 1e3, trap = 1e3;
    for (int i = 0; i < 7; i++) {
      c = abs(c) - vec2(0.56 + 0.13*sin(uTime*0.29 + float(i)), 0.34 + 0.11*cos(uTime*0.23 + float(i)*1.3));
      c = rot(0.4*float(i) + uTime*0.07 + uBar*0.61) * c;
      c *= 1.34; sc *= 1.34;
      edge = min(edge, abs(c.x)/sc);
      trap = min(trap, abs(length(c) - 0.7)/sc);
    }
    vec3 cc = pal2(trap*14.0 + uTime*0.1 + f);
    col += cc * exp(-edge*170.0) * 1.3 * kw;
    col += cc * exp(-trap*60.0) * 0.55 * kw;
  }

  // ---- layer 3: tunnel of die faces
  float tw = smoothstep(0.3, 0.8, uInt);
  if (tw > 0.001) {
    vec2 g = vec2(log(r + 0.03)*2.6 - uTime*0.55, ang*2.0/3.14159*3.0);
    vec2 id = floor(g);
    vec2 c = fract(g) - 0.5;
    c = rot(uTime*0.6 + hash(id)*6.28) * c;
    float n = 1.0 + 2.0*floor(hash(id + 3.0)*3.0);
    float sq = abs(max(abs(c.x), abs(c.y)) - 0.32);
    float show = step(0.35, hash(id + 7.0));
    vec3 tc = pal(hash(id)*0.5 + uTime*0.08);
    col += tc * show * (smoothstep(0.03, 0.0, sq)*0.9 + smoothstep(0.07, 0.04, pips(c, n))*1.1) * tw * smoothstep(0.02, 0.2, r);
  }

  // ---- layer 4: a ring per beat — fades in over 80 ms instead of popping
  for (int i = 0; i < 6; i++) {
    float age = uRings[i];
    if (age < 2.2) col += pal(age*0.3) * exp(-pow((length(uv) - (0.04 + age*0.62))*30.0, 2.0)) * exp(-age*1.4) * smoothstep(0.0, 0.08, age) * (0.6 + 0.8*uInt);
  }

  // core glow
  col += pal(uTime*0.05) * 0.25 / (1.0 + length(uv)*6.0) * (0.5 + uBass);
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float ca = (0.006 + 0.02*uHigh) * uInt * (1.0 - uMix);
  vec3 col;
  col.r = scene(uv * (1.0 + ca)).r;
  col.g = scene(uv).g;
  col.b = scene(uv * (1.0 - ca)).b;

  // beat swells (smooth attack and decay; no flashes, no inversion)
  col *= 1.0 + 0.35*uDown*uInt + 0.12*uBeat;

  // senza tempo: drain to violet
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum)*vec3(0.8, 0.66, 1.18), min(1.0, uMix*2.2)*0.8);

  // the ending: dissolve from inside the distortion, a thin violet glow on the eaten edge
  if (uDiss > 0.0) {
    vec2 dp = uv + uWarp * 0.9 * field(uv * 0.9);
    float n = 0.62 * fbm(dp * 4.2 + vec2(0.0, uClock * 0.05)) + 0.38 * fbm(dp * 1.3 - 2.0);
    float keep = smoothstep(uDiss - 0.08, uDiss + 0.08, n);
    float edge = exp(-pow((n - uDiss) / 0.025, 2.0)) * (1.0 - smoothstep(0.6, 0.7, uDiss));
    col = col * keep + vec3(0.62, 0.48, 1.0) * edge * 0.55;
  }

  col *= smoothstep(1.45, 0.25, length(uv));
  gl_FragColor = vec4(clamp(col, 0.0, 1.6) * uFade, 1.0);
}
`;
