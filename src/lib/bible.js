// The Bible in memory: one fetch of bible.json, then every lookup and search is local and instant.
// books[i] = { n, en, te, teShort, abbr[], teAbbr[], ch: [[ [telugu, english], ... ], ...] }

let books = [];
let aliases = [];  // [{ key, book, exact }]
let lowerEn = null; // lazily built for word search

export async function loadBible() {
  const res = await fetch('./bible.json');
  if (!res.ok) throw new Error('bible.json is missing. Run npm run bible.');
  books = (await res.json()).books;
  aliases = [];
  const key = (s) => s.toLowerCase().replace(/[\s.]+/g, '');
  for (const b of books) {
    const names = [b.en, b.te, b.teShort, ...(b.abbr || []), ...(b.teAbbr || [])].filter(Boolean);
    for (const name of new Set(names)) aliases.push({ key: key(name), book: b });
  }
  return books;
}

export const getBooks = () => books;
export const book = (n) => books[n - 1];
export const verseCount = (n, c) => (books[n - 1]?.ch[c - 1] || []).length;

const norm = (s) => s.toLowerCase().replace(/[\s.]+/g, '');

// The book a typed name means: an exact name or abbreviation first, then the first book whose name starts with it.
export function findBook(text) {
  const k = norm(text);
  if (!k) return null;
  const exact = aliases.find((a) => a.key === k);
  if (exact) return exact.book;
  const prefix = aliases.find((a) => a.key.startsWith(k));
  return prefix ? prefix.book : null;
}

export function suggestBooks(text, limit = 8) {
  const k = norm(text);
  if (!k) return [];
  const out = [];
  for (const a of aliases) if (a.key.startsWith(k) && !out.includes(a.book)) out.push(a.book);
  return out.slice(0, limit);
}

// "jn 3 16", "John 3:16-18", "1 jn 4.8", "యోహాను 3 16", "ps 23" (a whole chapter)
export function parseReference(q) {
  const m = /^\s*((?:[1-3]\s*)?[^\d\s][^\d]*?)\s*(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/u.exec(q);
  if (!m) return null;
  const b = findBook(m[1]);
  if (!b) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > b.ch.length) return { book: b.n, chapter: Math.min(Math.max(chapter, 1), b.ch.length), verse: null, verseEnd: null, error: `${b.en} has ${b.ch.length} chapters` };
  const max = b.ch[chapter - 1].length;
  let verse = m[3] ? Number(m[3]) : null;
  let verseEnd = m[4] ? Number(m[4]) : verse;
  if (verse && verse > max) return { book: b.n, chapter, verse: null, verseEnd: null, error: `${b.en} ${chapter} has ${max} verses` };
  if (verseEnd && verseEnd > max) verseEnd = max;
  if (verse && verseEnd < verse) verseEnd = verse;
  return { book: b.n, chapter, verse, verseEnd };
}

export const refLabel = (n, c, v, lang = 'en', vEnd = null) => {
  const b = books[n - 1];
  if (!b) return '';
  const name = lang === 'te' ? b.teShort : b.en;
  return `${name} ${c}${v ? `:${v}${vEnd && vEnd !== v ? `-${vEnd}` : ''}` : ''}`;
};

// Every verse that holds all the words, in either language. Telugu matching is by substring, so
// a stem like కృప finds కృపను and కృపయు.
export function searchWords(q, limit = 150) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return { hits: [], total: 0 };
  if (!lowerEn) lowerEn = books.map((b) => b.ch.map((vs) => vs.map((v) => v[1].toLowerCase())));
  const hits = [];
  let total = 0;
  for (const b of books) {
    for (let c = 0; c < b.ch.length; c++) {
      const vs = b.ch[c];
      for (let v = 0; v < vs.length; v++) {
        const te = vs[v][0], en = lowerEn[b.n - 1][c][v];
        if (words.every((w) => te.includes(w) || en.includes(w))) {
          total++;
          if (hits.length < limit) hits.push({ book: b.n, chapter: c + 1, verse: v + 1, te: vs[v][0], en: vs[v][1] });
        }
      }
    }
  }
  return { hits, total };
}

export const verseText = (n, c, v) => books[n - 1]?.ch[c - 1]?.[v - 1] || ['', ''];
