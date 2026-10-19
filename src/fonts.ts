import {continueRender, delayRender, staticFile} from 'remotion';
import {loadFont as loadMincho} from '@remotion/google-fonts/ShipporiMincho';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import assets from './data/assets.json';

/**
 * Fonts: local files in public/fonts win (works offline / in mainland China).
 * Expected names (ttf / otf / woff / woff2):
 *   jp-400.*  jp-600.*  jp-800.*   ← Shippori Mincho Regular / SemiBold / ExtraBold
 *   en-300.*  en-500.*             ← Cormorant Garamond Light / Medium
 * If none are present, Google Fonts is used (needs internet access to fonts.gstatic.com).
 */
const local = ((assets as {fonts?: string[]}).fonts ?? []).filter((f) => /^(jp|en)-\d{3}\./.test(f));

const loadLocal = (family: string, prefix: string) => {
  const files = local.filter((f) => f.startsWith(prefix + '-'));
  files.forEach((f) => {
    const weight = f.slice(prefix.length + 1, prefix.length + 4);
    const handle = delayRender(`font ${f}`);
    const face = new FontFace(family, `url(${staticFile('fonts/' + f)})`, {weight});
    face
      .load()
      .then((ff) => {
        (document.fonts as unknown as {add: (f: FontFace) => void}).add(ff);
        continueRender(handle);
      })
      .catch((e) => {
        console.error('font failed', f, e);
        continueRender(handle);
      });
  });
  return files.length > 0;
};

const hasJp = loadLocal('MV JP', 'jp');
const hasEn = loadLocal('MV EN', 'en');

const jpFamily = hasJp ? "'MV JP'" : loadMincho('normal', {weights: ['400', '600', '800'], subsets: ['japanese', 'latin']}).fontFamily;
const enFamily = hasEn ? "'MV EN'" : loadCormorant('normal', {weights: ['300', '500'], subsets: ['latin']}).fontFamily;

export const FONT_JP = `${jpFamily}, 'Noto Serif JP', serif`;
export const FONT_EN = `${enFamily}, ${jpFamily}, serif`;
