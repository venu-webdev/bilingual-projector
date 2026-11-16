// Song text in, slides out. Paste lyrics in whatever shape they come in (a website, WhatsApp,
// a Word file, the old app) and this works out the stanzas, the chorus repeats and the two languages.
//
// What it understands:
//   - stanzas split by empty lines, by numbers ("1." "2)"), or by headings (Chorus, Verse 2, పల్లవి, చరణం 1, [Bridge])
//   - "||మహిమ||" at the end of a stanza: sing the stanza that starts with మహిమ again here
//   - repeat marks at line ends: (2), x2, 2 times  (kept, or hidden when marks: 'hide')
//   - Telugu lines and English or transliterated lines in one stanza, or as alternate stanzas:
//     Telugu becomes the main text and the other language goes under it
//   - website noise: chord lines, [G] chords, URLs, "Singer:", "Lyrics:", "Music:" credits
//   - a song with no empty lines at all: cut into slides of four lines
// Pure functions, no DOM: tested in tests/lyrics.test.mjs.

const TELUGU = /[ఀ-౿]/;
const LATIN = /[A-Za-z]/;
const HEADING = /^\s*[[(]?\s*(chorus|refrain|pre-?chorus|verse|stanza|bridge|ending|outro|intro|tag|coda|పల్లవి|అనుపల్లవి|చరణం|చరణము)\s*(\d+)?\s*[\])]?\s*[:.\-–]?\s*(.*)$/iu;
const NUMBERED = /^\s*(\d{1,2})\s*[.)]\s+(.+)$/u;
const CHORD = /^[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\/[A-G](?:#|b)?)?$/;
const CREDIT_WORD = '(?:title|song|lyrics?|lyricist|written\\s+by|writer|words|music|composer|composed\\s+by|singer|sung\\s+by|vocals?|album|tune|scale|key|tempo|bpm|chords?|copyright|ccli|source)';
// one credit or several joined ("Lyrics & Tune:", "Words and Music:", "Music / Singer:")
const CREDIT = new RegExp(`^\\s*(${CREDIT_WORD}(?:\\s*(?:&|and|,|\\/|\\+)\\s*${CREDIT_WORD})*)\\s*[:\\-–]\\s*(.*)$`, 'i');
const NOISE = /(https?:\/\/|www\.|©|\badvertisement\b|\bclick here\b|\bdownload\b|\bshare\b\s*$|\bsubscribe\b)/i;
const MARKER = /\|\|\s*([^|]+?)\s*\|\|/gu;
const REPEAT_MARK = /\s*[–—-]?\s*(?:[([]\s*(?:x\s*)?\d\s*(?:x|times)?\s*[)\]]|\bx\s?\d\b|\b\d\s?x\b)\s*$/iu;

const isChordLine = (l) => { const t = l.trim().split(/\s+/); return t.length > 0 && t.every((w) => CHORD.test(w)); };
const firstWord = (s) => (s || '').replace(MARKER, '').trim().split(/[\s,–—\-.…]+/u)[0] || '';
const script = (l) => (TELUGU.test(l) ? 'te' : LATIN.test(l) ? 'en' : 'other');

/**
 * @param {string} raw
 * @param {{ repeat?: boolean, marks?: 'keep'|'hide', second?: 'show'|'hide' }} [opts]
 * @returns {{ title: string, author: string, stanzas: { te: string, en: string, label: string, repeat?: boolean }[] }}
 */
export function parseLyrics(raw, opts = {}) {
  const { repeat = true, marks = 'keep', second = 'show' } = opts;
  let title = '', author = '';

  // 1. clean the text
  const lines = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[​﻿]/g, '')        // invisible junk (ZWNJ/ZWJ are real Telugu and stay)
    .replace(/ /g, ' ')
    .replace(/\[[A-G](?:#|b)?[^\]\s]{0,6}\]/g, '') // inline [G] chords
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').replace(/ {2,}/g, ' ').trimEnd());

  // 2. walk the lines into blocks
  const blocks = [];
  let cur = null;
  const open = (label = '') => { cur = { lines: [], label }; blocks.push(cur); };
  const close = () => { cur = null; };
  for (const line of lines) {
    const t = line.trim();
    if (!t) { close(); continue; }
    const credit = CREDIT.exec(t);
    if (credit && !TELUGU.test(credit[1])) {
      const k = credit[1].toLowerCase(), v = credit[2].trim();
      if (/^(title|song)$/.test(k) && v) title = title || v;
      else if (/lyric|writ|word|compos|singer|sung|vocal/.test(k) && v && !author) author = v;
      continue;
    }
    if (NOISE.test(t) || isChordLine(t)) continue;
    const h = HEADING.exec(t);
    if (h && (h[3] === '' || /[:.\-–]/.test(t.slice(h[1].length, h[1].length + 6)))) {
      const name = h[1].toLowerCase();
      const label = /chorus|refrain|పల్లవి/.test(name) ? 'Chorus' : /bridge/.test(name) ? 'Bridge' : /pre-?chorus|అనుపల్లవి/.test(name) ? 'Pre-chorus' : /ending|outro|coda|tag/.test(name) ? 'Ending' : `Verse${h[2] ? ` ${h[2]}` : ''}`;
      open(label);
      if (h[3]) cur.lines.push(h[3]);
      continue;
    }
    const num = NUMBERED.exec(t);
    if (num) { open(`Verse ${num[1]}`); cur.lines.push(num[2]); continue; }
    if (!cur) open();
    cur.lines.push(t);
  }
  let groups = blocks.filter((b) => b.lines.length);

  // 3. a title line on its own at the top (a transliterated name above Telugu lyrics, or a line the song repeats)
  if (!title && groups.length > 1 && groups[0].lines.length === 1 && !groups[0].label) {
    const only = groups[0].lines[0];
    const bodyTe = groups.slice(1).some((g) => g.lines.some((l) => TELUGU.test(l)));
    if (only.length <= 60 && !/\|\|[^|]+\|\|/u.test(only) && ((script(only) === 'en' && bodyTe) || groups.slice(1).some((g) => g.lines[0].startsWith(only.slice(0, 12))))) {
      title = only;
      groups = groups.slice(1);
    }
  }

  // 4. one long block with no breaks: four lines a slide
  if (groups.length === 1 && groups[0].lines.length > 8) {
    const all = groups[0].lines;
    groups = [];
    for (let i = 0; i < all.length; i += 4) groups.push({ lines: all.slice(i, i + 4), label: '' });
  }

  // 5. pull repeat markers off the lines. A marker ends its stanza (and repeats the chorus after it) when
  //    nothing but the other language follows it: the last line, or a Telugu line with only its
  //    transliteration under it. A marker in the middle of a stanza is just removed.
  for (const g of groups) {
    g.lines = g.lines.map((l, i) => {
      let ref = null;
      const stripped = l.replace(MARKER, (_, w) => { ref = w; return ''; }).trimEnd();
      if (ref) {
        const rest = g.lines.slice(i + 1);
        if (rest.every((r) => script(r) !== script(l) && !/\|\|/.test(r))) g.repeatOf = ref;
      }
      return stripped;
    }).filter((l) => l.trim());
  }
  groups = groups.filter((g) => g.lines.length);

  // 6. languages: Telugu lines are the main text, Latin-script lines go underneath
  let stanzas = groups.map((g) => {
    const te = g.lines.filter((l) => script(l) !== 'en');
    const en = g.lines.filter((l) => script(l) === 'en');
    return { te: te.join('\n'), en: en.join('\n'), label: g.label, repeatOf: g.repeatOf };
  });
  // Telugu stanza followed by an English-only stanza of the same size: a translation pair
  const paired = [];
  for (let i = 0; i < stanzas.length; i++) {
    const a = stanzas[i], b = stanzas[i + 1];
    if (a.te && !a.en && b && !b.te && b.en && TELUGU.test(a.te) && Math.abs(a.te.split('\n').length - b.en.split('\n').length) <= 1) {
      paired.push({ ...a, en: b.en, repeatOf: a.repeatOf || b.repeatOf });
      i++;
    } else paired.push(a);
  }
  stanzas = paired;

  // A song with no Telugu at all keeps its words as the main text.
  for (const s of stanzas) if (!s.te && s.en) { s.te = s.en; s.en = ''; }

  // 7. tidy each stanza
  const tidy = (txt) => txt.split('\n').map((l) => (marks === 'hide' ? l.replace(REPEAT_MARK, '') : l).replace(/\s*[–—-]\s*$/u, '').trim()).filter(Boolean).join('\n');
  stanzas = stanzas.map((s) => ({ ...s, te: tidy(s.te), en: second === 'hide' ? '' : tidy(s.en) }));

  // 8. the arrangement: repeat the chorus where a ||marker|| asks for it
  const out = [];
  const keyOf = (s) => firstWord(s.te).toLowerCase();
  stanzas.forEach((s, i) => {
    out.push({ te: s.te, en: s.en, label: s.label || (i === 0 && stanzas.length > 1 ? 'Chorus' : '') });
    if (repeat && s.repeatOf) {
      const want = firstWord(s.repeatOf).toLowerCase();
      const target = stanzas.find((x, j) => j !== i && want && (keyOf(x).startsWith(want) || want.startsWith(keyOf(x)) && keyOf(x).length > 2));
      if (target) out.push({ te: target.te, en: target.en, label: `${target.label || 'Chorus'} again`, repeat: true });
    }
  });

  if (!title) title = (out[0]?.te.split('\n')[0] || '').replace(REPEAT_MARK, '').replace(/\s*[–—-]\s*$/u, '').trim().slice(0, 80);
  return { title, author, stanzas: out };
}
