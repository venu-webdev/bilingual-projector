// Ready-made looks. Each comes as a pair: the Bible version (reference on, room for longer text, both
// languages) and the song version (no reference, larger words, the second language smaller). They share
// a background and colours so a service looks like one thing from the first song to the sermon.
//
// Built for a projector in a real room: dark grounds unless the room is bright, no thin type, no colour
// on the words except the reference, and contrast that survives a washed-out projector.

const ref = (color, extra = {}) => ({ show: true, lang: 'te', position: 'bottom', color, size: 40, ...extra });

const pair = (base, bible = {}, song = {}) => ({
  bible: { layout: 'both', teSize: 76, enSize: 50, reference: ref(base.refColor), ...strip(base), ...bible },
  song: { layout: 'both', teSize: 88, enSize: 46, reference: { ...ref(base.refColor), show: false }, ...strip(base), ...song },
});
const strip = ({ refColor, ...rest }) => rest;

const common = { teFont: 'Hind Guntur', enFont: 'Inter', weight: 600, lineHeight: 1.4, align: 'center', shadow: true, position: 'center', minFit: 0.85, steady: true, motion: 'fade', motionSpeed: 'normal' };

export const PRESETS = [
  {
    id: 'midnight', name: 'Midnight', use: 'Any room; the default',
    ...pair({ ...common, background: { type: 'gradient', from: '#0d2a5c', to: '#05070d', angle: 135, color: '#0b1020', media: '', dim: 0.35 }, teColor: '#ffffff', enColor: '#d6deea', refColor: '#ffd36b' }),
  },
  {
    id: 'black', name: 'Pure black', use: 'Weak projectors, the sharpest words',
    ...pair({ ...common, shadow: false, background: { type: 'solid', color: '#000000', from: '#000000', to: '#000000', angle: 135, media: '', dim: 0.35 }, teColor: '#ffffff', enColor: '#c9d1dc', refColor: '#ffcf5a' }),
  },
  {
    id: 'sanctuary', name: 'Sanctuary', use: 'Warm, for worship and prayer',
    ...pair({ ...common, motion: 'blur', motionSpeed: 'slow', background: { type: 'gradient', from: '#3d2616', to: '#0c0705', angle: 160, color: '#1a110b', media: '', dim: 0.35 }, teColor: '#fff6e8', enColor: '#e8d9c2', refColor: '#e8b45a' }),
  },
  {
    id: 'evergreen', name: 'Evergreen', use: 'Calm, for scripture readings',
    ...pair({ ...common, motion: 'rise', background: { type: 'gradient', from: '#0f3d34', to: '#03100d', angle: 150, color: '#082520', media: '', dim: 0.35 }, teColor: '#ffffff', enColor: '#cfe6de', refColor: '#9fe3c6' }),
  },
  {
    id: 'bold', name: 'Bold worship', use: 'Big, heavy words for singing',
    ...pair(
      { ...common, motion: 'zoom', motionSpeed: 'fast', background: { type: 'gradient', from: '#24202e', to: '#060509', angle: 180, color: '#111', media: '', dim: 0.35 }, teColor: '#ffffff', enColor: '#d7d3e2', refColor: '#ffb86b' },
      { teFont: 'Noto Sans Telugu', weight: 700 },
      { teFont: 'Ramabhadra', weight: 400, teSize: 96, lineHeight: 1.3 },
    ),
  },
  {
    id: 'daylight', name: 'Daylight', use: 'Bright rooms where dark slides wash out',
    ...pair({ ...common, shadow: false, background: { type: 'solid', color: '#f6f1e7', from: '#f6f1e7', to: '#e9e1d2', angle: 180, media: '', dim: 0 }, teColor: '#1c1914', enColor: '#4b443a', refColor: '#9a5b0c' }),
  },
  {
    id: 'scroll', name: 'Scripture card', use: 'Reading aloud: reference first, left aligned',
    ...pair(
      { ...common, motion: 'cascade', align: 'left', background: { type: 'gradient', from: '#1c2433', to: '#0a0d13', angle: 120, color: '#121822', media: '', dim: 0.35 }, teColor: '#ffffff', enColor: '#c9d3e2', refColor: '#8ec5ff' },
      { reference: ref('#8ec5ff', { position: 'top', size: 46 }) },
      { align: 'center' },
    ),
  },
  {
    id: 'lower', name: 'Lower third', use: 'Livestream over a camera or video background',
    ...pair(
      { ...common, motion: 'rise', position: 'lower', band: { color: '#000000', opacity: 0.62 }, background: { type: 'solid', color: '#1d2836', from: '#1d2836', to: '#0b1017', angle: 135, media: '', dim: 0.2 }, teColor: '#ffffff', enColor: '#dbe3ee', refColor: '#ffd36b' },
      { teSize: 54, enSize: 36, reference: ref('#ffd36b', { size: 30 }) },
      { teSize: 60, enSize: 36 },
    ),
  },
  {
    id: 'green', name: 'Green screen', use: 'OBS: key out the green to lay words over the camera',
    ...pair(
      { ...common, position: 'lower', band: { color: '#000000', opacity: 0.7 }, background: { type: 'solid', color: '#00b140', from: '#00b140', to: '#00b140', angle: 0, media: '', dim: 0 }, teColor: '#ffffff', enColor: '#e6ecf3', refColor: '#ffd36b' },
      { teSize: 54, enSize: 36, reference: ref('#ffd36b', { size: 30 }) },
      { teSize: 60, enSize: 36 },
    ),
  },
];

// What a preset carries over when it is applied. Background media the operator chose is kept if the
// preset's own background is the same kind, so a church's own video survives a change of look.
export function applyPreset(theme, presetTheme) {
  const keepMedia = theme.background && (theme.background.type === 'image' || theme.background.type === 'video') && theme.background.media;
  const next = { ...theme, ...structuredClone(presetTheme) };
  if (keepMedia && presetTheme.position === 'lower') next.background = { ...theme.background };
  if (!next.band) next.band = { color: '#000000', opacity: 0.6 };
  return next;
}

// The fields that make two looks belong together. With "Same look for songs and Bible" on, changing
// one of these on one side changes it on the other; sizes, layout and the reference stay separate.
export const SHARED = ['background', 'teFont', 'enFont', 'teColor', 'enColor', 'shadow', 'band', 'motion', 'motionSpeed'];
export function shareLook(from, to) {
  const out = { ...to };
  for (const k of SHARED) out[k] = structuredClone(from[k]);
  if (from.reference && to.reference) out.reference = { ...to.reference, color: from.reference.color };
  return out;
}

export const SAMPLE = {
  bible: { id: 'sample-b', kind: 'bible', te: 'దేవుడు లోకమును ఎంతో ప్రేమించెను. కాగా ఆయన తన అద్వితీయకుమారునిగా పుట్టిన వానియందు విశ్వాసముంచు ప్రతివాడును నశింపక నిత్యజీవము పొందునట్లు ఆయనను అనుగ్రహించెను.', en: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', refTe: 'యోహాను 3:16', refEn: 'John 3:16' },
  song: { id: 'sample-s', kind: 'song', te: 'మహిమ నీకే ప్రభూ – ఘనత నీకే ప్రభూ\nస్తుతి మహిమ ఘనతయు – ప్రభావము నీకే ప్రభూ', en: 'Glory to you, Lord, honour to you, Lord\nPraise, glory and honour belong to you', refTe: 'మహిమ నీకే ప్రభూ', refEn: 'Mahima Neeke Prabhu' },
};
