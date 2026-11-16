// The library: songs, service orders and settings, kept in one JSON file in the user's app-data folder.
// Writes are atomic (temp file then rename), so a crash or power cut never leaves a half-written file,
// and the last ten versions are kept as rolling backups.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_THEME = {
  background: { type: 'gradient', color: '#0b1020', from: '#0d2a5c', to: '#05070d', angle: 135, media: '', dim: 0.35 },
  layout: 'both',            // both | te | en | side
  teFont: 'Hind Guntur', enFont: 'Inter',
  teSize: 72, enSize: 48,    // px on a 1920 x 1080 screen; text shrinks to fit, never grows past these
  teColor: '#ffffff', enColor: '#dfe4ee',
  weight: 600, lineHeight: 1.4, align: 'center', shadow: true,
  reference: { show: true, lang: 'te', position: 'bottom', color: '#ffd36b', size: 34 },
  minFit: 0.85,              // a verse that would shrink below this is split onto more slides
  steady: true,              // every slide of a passage uses the same text size
};

const defaults = () => ({
  version: 1,
  songs: [],
  setlists: [{ id: 'default', name: 'Service order', items: [] }],
  images: [],                                            // { id, url, name, credit, source, w, h, adjust }
  history: [],                                           // { id, book, chapter, verse, note, at }: verses kept with a double-click
  imageSets: [{ id: 'pictures', name: 'Pictures', imageIds: [] }],
  settings: {
    activeSetlist: 'default',
    output: { displayId: null, mode: 'windowed' },
    stage: { displayId: null, showEnglish: true },
    split: 'fit',
    themes: { bible: structuredClone(DEFAULT_THEME), song: { ...structuredClone(DEFAULT_THEME), layout: 'te', reference: { ...DEFAULT_THEME.reference, show: false } } },
  },
});

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'library.json');
    this.backups = path.join(dir, 'backups');
    fs.mkdirSync(this.backups, { recursive: true });
    this.data = this.read();
    this.rotateBackup();
  }

  read() {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const base = defaults();
      return { ...base, ...d, settings: { ...base.settings, ...d.settings, themes: { ...base.settings.themes, ...(d.settings && d.settings.themes) } } };
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Keep the unreadable file aside instead of overwriting it.
        try { fs.renameSync(this.file, `${this.file}.broken-${Date.now()}`); } catch {}
      }
      return defaults();
    }
  }

  write() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }

  rotateBackup() {
    if (!fs.existsSync(this.file)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(this.file, path.join(this.backups, `library-${stamp}.json`));
    const old = fs.readdirSync(this.backups).filter((f) => f.startsWith('library-')).sort();
    for (const f of old.slice(0, Math.max(0, old.length - 10))) fs.rmSync(path.join(this.backups, f), { force: true });
  }

  get() { return this.data; }

  // Replace whole top-level sections the renderer sends back (songs, setlists, settings).
  patch(part) {
    for (const k of ['songs', 'setlists', 'settings', 'images', 'imageSets', 'history']) if (part && part[k] !== undefined) this.data[k] = part[k];
    this.write();
    return true;
  }

  // Accepts this app's own export, or a backup from the original Bilingual Projector Pro.
  import(json) {
    if (json && json.version === 1 && Array.isArray(json.songs)) {
      this.data = { ...defaults(), ...json };
      this.write();
      return { songs: this.data.songs.length, setlists: this.data.setlists.length };
    }
    if (!json || !Array.isArray(json.songs)) throw new Error('This file is not a projector backup.');
    const now = new Date().toISOString();
    const songs = json.songs.map((s) => ({ id: String(s.id), title: s.title || 'Untitled', author: s.author && s.author !== 'Unknown Artist' ? s.author : '', lyrics: s.lyrics || '', english: s.english || '', updatedAt: s.updatedAt || now }));
    const known = new Set(songs.map((s) => s.id));
    const setlists = (json.setlists || []).map((l) => ({
      id: String(l.id || Date.now()),
      name: l.name || 'Service order',
      items: (l.items || []).flatMap((it) => {
        if (it.type === 'bible' && it.bookNumber) return [{ id: cryptoId(), type: 'bible', book: it.bookNumber, chapter: it.chapter, verse: it.verse, verseEnd: it.verse }];
        const sid = it.songId || (it.songData && it.songData.id);
        if (it.type === 'song' && sid && known.has(String(sid))) return [{ id: cryptoId(), type: 'song', songId: String(sid) }];
        return [];
      }).filter((it, i, all) => it.type !== 'song' || all.findIndex((o) => o.type === 'song' && o.songId === it.songId) === i),
    }));
    const base = defaults();
    const st = json.settings || {};
    const themes = {
      bible: convertTheme(st.bibleTheme || st.theme, base.settings.themes.bible),
      song: convertTheme(st.songTheme || st.theme, base.settings.themes.song),
    };
    // pictures already in this app are kept: the old app had none to bring
    this.data = { ...base, images: this.data.images || [], imageSets: this.data.imageSets || base.imageSets, history: this.data.history || [], songs, setlists: setlists.length ? setlists : base.setlists, settings: { ...base.settings, activeSetlist: (setlists[0] || base.setlists[0]).id, themes } };
    this.write();
    return { songs: songs.length, setlists: setlists.length };
  }
}

let n = 0;
function cryptoId() { return `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

// The original app's theme fields mapped onto this app's smaller theme model.
function convertTheme(t, fallback) {
  if (!t) return structuredClone(fallback);
  const layout = { 'telugu-only': 'te', 'english-only': 'en', 'side-by-side': 'side' }[t.layoutMode] || 'both';
  return {
    background: {
      type: ['solid', 'gradient', 'image', 'video'].includes(t.backgroundType) ? t.backgroundType : 'gradient',
      color: t.solidColor || fallback.background.color,
      from: t.gradientStart || fallback.background.from,
      to: t.gradientEnd || fallback.background.to,
      angle: Number(t.gradientAngle) || 135,
      media: '', // media files lived in the old app's folder; pick them again in Theme
      dim: fallback.background.dim,
    },
    layout,
    teFont: t.fontTeluguSelect && t.fontTeluguSelect !== 'custom' ? t.fontTeluguSelect : fallback.teFont,
    enFont: t.fontEnglishSelect && t.fontEnglishSelect !== 'custom' ? t.fontEnglishSelect : fallback.enFont,
    teSize: Number(t.fontSizeTelugu) || fallback.teSize,
    enSize: Number(t.fontSizeEnglish) || fallback.enSize,
    teColor: t.textColorTelugu || fallback.teColor,
    enColor: t.textColorEnglish || fallback.enColor,
    weight: t.fontWeightTelugu === 'normal' ? 400 : 600,
    lineHeight: Number(t.lineSpacing) || fallback.lineHeight,
    align: t.alignment === 'left' ? 'left' : 'center',
    shadow: t.textShadowEnable !== false,
    reference: {
      show: t.referencePosition !== 'hidden',
      lang: t.referenceLanguage === 'english' ? 'en' : 'te',
      position: t.referencePosition === 'before' || t.referencePosition === 'above-overlay' ? 'top' : 'bottom',
      color: t.referenceColor || fallback.reference.color,
      size: Number(t.referenceFontSize) || fallback.reference.size,
    },
  };
}

module.exports = { Store, DEFAULT_THEME };
