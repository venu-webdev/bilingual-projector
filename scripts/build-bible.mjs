// One-time conversion: the Telugu Bible (BSI, XML) + the King James Version (CSV) -> public/bible.json,
// a compact index the app loads in one fetch.
//
//   npm run bible                       Telugu from data/telugu.xml, else ../experiment/BSI_bible.xml
//   npm run bible -- <telugu.xml>       Telugu from another file
//
// English: data/kjv.csv, the King James Version from scrollmapper/bible_databases (public domain text,
// MIT-licensed data), with all 31,102 verses. It replaced an older kjv.json that had verses missing or
// doubled in 10 chapters (Matthew 2, Mark 7, ...) and translators' margin notes on about 6,400 verses.
// Book names (English, Telugu, abbreviations): data/books.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TE = resolve(process.argv[2] || [join(ROOT, 'data', 'telugu.xml'), join(ROOT, '..', 'experiment', 'BSI_bible.xml')].find((f) => existsSync(f)) || '');
if (!existsSync(TE)) { console.error('No Telugu Bible XML found. Put it at data/telugu.xml or pass its path: npm run bible -- <file>'); process.exit(1); }
const meta = JSON.parse(readFileSync(join(ROOT, 'data', 'books.json'), 'utf8'));

// ---- Telugu ----
const xml = readFileSync(TE, 'utf8').replace(/^﻿/, '');
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

// ---- English: a small CSV reader (quoted fields, doubled quotes) ----
function* csvRows(text) {
  let i = 0, field = '', row = [], quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { quoted = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); yield row; row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field || row.length) { row.push(field); yield row; }
}
const english = new Map(); // book number -> chapters[] -> verses[]
const bookOrder = [];
let header = true;
for (const [book, ch, vs, text] of csvRows(readFileSync(join(ROOT, 'data', 'kjv.csv'), 'utf8').replace(/^﻿/, ''))) {
  if (header) { header = false; continue; }
  if (!book) continue;
  if (!bookOrder.includes(book)) bookOrder.push(book);
  const n = bookOrder.indexOf(book) + 1; // the CSV runs Genesis to Revelation in canonical order
  if (!english.has(n)) english.set(n, []);
  const chapters = english.get(n);
  (chapters[Number(ch) - 1] ||= [])[Number(vs) - 1] = text.replace(/\s+/g, ' ').trim();
}
if (bookOrder.length !== 66) { console.error(`kjv.csv has ${bookOrder.length} books, expected 66`); process.exit(1); }

// ---- merge ----
let verseCount = 0;
const books = meta.map((m) => {
  const te = telugu.get(m.n) || [], en = english.get(m.n) || [];
  const ch = [];
  for (let c = 0; c < Math.max(te.length, en.length); c++) {
    const tv = te[c] || [], ev = en[c] || [];
    const rows = [];
    for (let v = 0; v < Math.max(tv.length, ev.length); v++) rows.push([tv[v] || '', ev[v] || '']);
    verseCount += rows.length;
    ch.push(rows);
  }
  return { ...m, ch };
});

mkdirSync(join(ROOT, 'public'), { recursive: true });
const out = join(ROOT, 'public', 'bible.json');
writeFileSync(out, JSON.stringify({ version: 2, books }));
console.log(`wrote ${out}: ${books.length} books, ${verseCount} verses (Telugu from ${TE})`);

// Chapters where the two Bibles differ in verse count: a verse there shows in one language only.
const uneven = [];
for (const m of meta) {
  const te = telugu.get(m.n) || [], en = english.get(m.n) || [];
  for (let c = 0; c < Math.max(te.length, en.length); c++) {
    const a = (te[c] || []).length, b = (en[c] || []).length;
    if (a !== b) uneven.push(`${m.en} ${c + 1} (Telugu ${a}, English ${b})`);
  }
}
if (uneven.length) console.warn(`note: ${uneven.length} chapter(s) differ in verse count; the extra verse shows in one language:\n  ${uneven.join('\n  ')}`);
