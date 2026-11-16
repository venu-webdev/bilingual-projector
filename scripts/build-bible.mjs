// One-time conversion: Telugu BSI XML + KJV JSON -> public/bible.json, a compact index the app loads in one fetch.
//   npm run bible -- [path to the folder holding BSI_bible.xml, kjv.json and src/bible-metadata.js]
// Default source folder is the original app at ../experiment.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(process.argv[2] || join(ROOT, '..', 'experiment'));
const meta = createRequire(import.meta.url)(join(SRC, 'src', 'bible-metadata.js'));

const xml = readFileSync(join(SRC, 'BSI_bible.xml'), 'utf8').replace(/^﻿/, '');
const kjv = JSON.parse(readFileSync(join(SRC, 'kjv.json'), 'utf8').replace(/^﻿/, ''));

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const telugu = new Map();
for (const [, bn, body] of xml.matchAll(/<BIBLEBOOK\s+bnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/g)) {
  const chapters = [];
  for (const [, cn, cbody] of body.matchAll(/<CHAPTER\s+cnumber="(\d+)">([\s\S]*?)<\/CHAPTER>/g)) {
    const verses = [];
    for (const [, vn, text] of cbody.matchAll(/<VERS\s+vnumber="(\d+)">([\s\S]*?)<\/VERS>/g)) verses[Number(vn) - 1] = decode(text.trim().replace(/\s+/g, ' '));
    chapters[Number(cn) - 1] = verses;
  }
  telugu.set(Number(bn), chapters);
}

// This KJV file carries the translators' margin notes on the end of about one verse in five
// ("...the thing accursed. Achar: or, Achan"). They are not scripture and must not reach the screen.
// A note starts with a key word (sometimes "words...") then a colon and Heb. / or, / that is, ...; the verse
// ends at the last punctuation before the first note.
const NOTE = /\s[A-Za-z’'-]+(?:\.\.\.)?(?:\s[A-Za-z’'-]+\.\.\.)?:\s(?:Heb\.|or,|Or,|Gr\.|Chald\.|Syr\.|that is,|i\.e\.|Gk\.)/;
function stripNotes(s) {
  const m = NOTE.exec(s);
  if (!m) return s;
  const head = s.slice(0, m.index);
  const end = Math.max(...['.', '?', '!', ';', ':', ',', ')'].map((p) => head.lastIndexOf(p)));
  return (end > 0 ? head.slice(0, end + 1) : head).trim();
}
let notesRemoved = 0;
// KJV marks supplied words with braces ({was}); keep the word, drop the braces.
const clean = (s) => {
  const t = (s || '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  const u = stripNotes(t);
  if (u !== t) notesRemoved++;
  return u;
};

let verseCount = 0;
const books = meta.map((m) => {
  const te = telugu.get(m.number) || [];
  const en = (kjv[m.number - 1] && kjv[m.number - 1].chapters) || [];
  const chapters = Math.max(te.length, en.length);
  const ch = [];
  for (let c = 0; c < chapters; c++) {
    const tv = te[c] || [], ev = en[c] || [];
    const n = Math.max(tv.length, ev.length);
    const rows = [];
    for (let v = 0; v < n; v++) rows.push([tv[v] || '', clean(ev[v])]);
    verseCount += n;
    ch.push(rows);
  }
  return { n: m.number, en: m.name, te: m.teluguName, teShort: m.teluguShort, abbr: m.abbr, teAbbr: m.teluguAbbr, ch };
});

mkdirSync(join(ROOT, 'public'), { recursive: true });
const out = join(ROOT, 'public', 'bible.json');
writeFileSync(out, JSON.stringify({ version: 1, books }));
console.log(`wrote ${out}: ${books.length} books, ${verseCount} verses, margin notes removed from ${notesRemoved}`);

// Chapters where the two Bibles have a different number of verses: the English after the gap is
// out of step with the Telugu. Some are real numbering differences, most are faults in kjv.json.
const uneven = [];
for (const m of meta) {
  const te = telugu.get(m.number) || [], en = (kjv[m.number - 1] && kjv[m.number - 1].chapters) || [];
  for (let c = 0; c < Math.max(te.length, en.length); c++) {
    const a = (te[c] || []).length, b = (en[c] || []).length;
    if (a !== b) uneven.push(`${m.name} ${c + 1} (Telugu ${a}, English ${b})`);
  }
}
if (uneven.length) console.warn(`\nwarning: ${uneven.length} chapters have different verse counts, so their English may sit beside the wrong Telugu verse:\n  ${uneven.join('\n  ')}`);
