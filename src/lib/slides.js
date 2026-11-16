// Turning a Bible chapter or a song into slides. A slide is everything the screen needs:
// { id, kind: 'bible' | 'song', num, te, en, refTe, refEn, verse, part, parts, fit }
//
// Long text is handled before it reaches the screen:
//   1. Split by measurement: a verse or stanza is split only when, measured in the real font, it would
//      have to shrink below `minFit` of the theme's size. Splits fall on sentence or clause ends, and the
//      Telugu and English are split into the same number of parts so they stay together.
//   2. Steady size: with `steady` on, every slide of a passage gets the same scale (the smallest any of
//      them needs), so the text does not jump in size from one verse to the next.
//   3. Continuation: a part that stops mid-sentence ends with an ellipsis, and slide.part / slide.parts
//      let the screen show where the reader is (the dots beside the reference).
import { book } from './bible.js';
import { fits, fitOf } from './fit.js';
import { parseLyrics } from './lyrics.js';

const MAX_PARTS = 6;

// Split text into k parts at sentence or clause ends, as evenly as the boundaries allow.
export function splitText(text, k) {
  if (k <= 1 || !text) return [text];
  let pieces = text.split(/(?<=[.;:!?।])\s+/u).filter(Boolean);
  if (pieces.length < k) pieces = text.split(/(?<=[.;:!?,।])\s+/u).filter(Boolean);
  if (pieces.length < k) {
    const words = text.split(/\s+/);
    const size = Math.ceil(words.length / k);
    return Array.from({ length: k }, (_, i) => words.slice(i * size, (i + 1) * size).join(' ')).filter(Boolean);
  }
  const total = text.length;
  const out = [];
  let cur = '', made = 0;
  pieces.forEach((p, i) => {
    cur = cur ? `${cur} ${p}` : p;
    const left = pieces.length - i - 1, binsLeft = k - made - 1;
    if (binsLeft > 0 && (cur.length >= total / k || left === binsLeft)) { out.push(cur); cur = ''; made++; }
  });
  if (cur) out.push(cur);
  return out;
}

// Song stanzas split on whole lines, never mid-line.
function splitLines(text, k) {
  const lines = text.split('\n');
  if (k <= 1 || lines.length < 2) return [text];
  const n = Math.min(k, lines.length);
  const size = Math.ceil(lines.length / n);
  return Array.from({ length: n }, (_, i) => lines.slice(i * size, (i + 1) * size).join('\n')).filter(Boolean);
}

const endsSentence = (s) => /[.!?;:।"”')\]]\s*$/u.test(s || '');
const cue = (s, more) => (more && s && !endsSentence(s) ? `${s.replace(/[\s,–-]+$/u, '')} …` : s);

// How many parts this text needs so each part fits at minFit or larger.
function plan(te, en, theme, minFit, splitter) {
  for (let k = 1; k <= MAX_PARTS; k++) {
    const tes = te ? splitter(te, k) : [''];
    const ens = en ? splitter(en, Math.max(1, tes.length)) : [];
    const parts = tes.map((t, i) => ({ te: t, en: ens[i] || '' }));
    if (k === MAX_PARTS || parts.every((p) => fits(p, theme, minFit))) return parts;
    if (tes.length < k) return parts; // cannot split any finer
  }
  return [{ te, en }];
}

function steady(slides, theme, on) {
  if (!on || slides.length === 0) return slides;
  let min = 1;
  for (const s of slides) min = Math.min(min, fitOf(s, theme));
  for (const s of slides) s.fit = min;
  return slides;
}

/** @param {{ split?: 'fit'|'none', theme: any }} opts */
export function chapterSlides(n, c, { split = 'fit', theme }) {
  const b = book(n);
  const verses = b?.ch[c - 1] || [];
  const minFit = theme.minFit ?? 0.85;
  const slides = [];
  verses.forEach(([te, en], i) => {
    const v = i + 1;
    const parts = split === 'none' ? [{ te, en }] : plan(te, en, theme, minFit, splitText);
    const k = parts.length;
    parts.forEach((p, j) => slides.push({
      id: `b-${n}-${c}-${v}-${j}`, kind: 'bible', verse: v,
      num: k > 1 ? `${v}${'abcdef'[j]}` : String(v),
      te: cue(p.te, j < k - 1), en: cue(p.en, j < k - 1),
      part: j + 1, parts: k,
      refTe: `${b.teShort} ${c}:${v}`,
      refEn: `${b.en} ${c}:${v}`,
    }));
  });
  return steady(slides, theme, theme.steady !== false);
}

const blocks = (text) => (text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

// The stanzas of a song, in the order they are sung. Songs saved by the first version (and the old app)
// may keep their English in a second field, paired stanza by stanza; everything else goes through the parser.
export function songStanzas(song) {
  if (song.english && song.english.trim()) {
    const te = blocks(song.lyrics), en = blocks(song.english);
    return te.map((t, i) => ({ te: t, en: en[i] || '', label: '' }));
  }
  return parseLyrics(song.lyrics, song.options || {}).stanzas;
}

/** @param {any} song @param {{ split?: 'fit'|'none', theme?: any }} [opts] */
export function songSlides(song, { split = 'fit', theme } = {}) {
  const slides = [];
  songStanzas(song).forEach((st, i) => {
    const parts = !theme || split === 'none' ? [{ te: st.te, en: st.en }] : plan(st.te, st.en, theme, theme.minFit ?? 0.85, splitLines);
    parts.forEach((p, j) => slides.push({
      id: `s-${song.id}-${i}-${j}`, kind: 'song', label: st.label || '', repeat: !!st.repeat,
      num: parts.length > 1 ? `${i + 1}${'abcdef'[j]}` : String(i + 1),
      te: p.te, en: p.en, part: j + 1, parts: parts.length,
      refTe: song.title, refEn: song.title,
    }));
  });
  return theme ? steady(slides, theme, theme.steady !== false) : slides;
}
