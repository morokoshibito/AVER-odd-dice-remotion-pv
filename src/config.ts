import settings from './render-settings.json';

export const W = settings.width;
export const H = settings.height;
export const FPS = settings.fps;
export const AUDIO_FILE = settings.audioFile;
/**
 * Data times are measured from the first sample of the instrumental inside the
 * SVP. If your mix was exported from SynthV with the project starting at 0,
 * set audioStartOffsetSec to the "inst offset" printed by extract_svp.py
 * (0.593 for the current project). Positive = audio events happen later.
 */
export const AUDIO_START_OFFSET_SEC = settings.audioStartOffsetSec;

export const SHOW_RUBY = false; // no furigana
export const SHOW_TRANSLATION = true; // only shows if translation.txt was provided

// ---------------------------------------------------------------- texts
export const TITLE = 'Odd Dice';
export const ORIGINAL_ARTIST = 'millsage';
export const COVER_LINE = 'Covered by 夢ノ結唱 AVER'; // shown at 0:12–0:20 and on the end card
// Outro credits: shown one at a time, bottom-left, during the kaleidoscope (2:57–3:35).
// Add / remove / reorder entries freely – the display time is split evenly between them.
// Layout & timing live in src/scenes/Titles.tsx → OutroTitles.
export const CREDITS: {role: string; name: string}[] = [
  {role: 'Original', name: 'millsage'},
  {role: 'Vocal', name: '夢ノ結唱 AVER (Synthesizer V)'},
  {role: 'Tuning / Mix', name: '小姨妈初音'},
  {role: 'Movie', name: 'Opus 5.5'},
];

// ---------------------------------------------------------------- look
export const PALETTE = {
  night: '#0b0d1f',
  indigo: '#1b1d45',
  violet: '#5b4b9a',
  lavender: '#c9c2f0',
  silver: '#e8e9f6',
  crimson: '#9e1b32',
  wine: '#5a0f1f',
  gold: '#d9b45a',
};

export {FONT_JP, FONT_EN} from './fonts';

/** the single illustration, in public/img */
export const PV_IMAGE = 'pv.png';

// The outro kaleidoscope renders at this fraction of the frame size, then is
// upscaled (faster on weak GPUs). 1 = full resolution.
export const VISUALIZER_SCALE = 1;
