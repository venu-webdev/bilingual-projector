// Everything the operator works with, in one place.
//   lib  : what is saved (songs, service orders, pictures, settings)
//   show : what is happening now (the loaded deck, the live slide, black and hidden)
// Browsing never changes the screen: the live slide is held on its own until the operator sends another.
import { chapterSlides, songSlides } from '../lib/slides.js';
import { refLabel } from '../lib/bible.js';
import { loadThemeFonts } from '../lib/fit.js';
import { applyPreset, shareLook } from '../lib/presets.js';
import { DEFAULT_ADJUST, fitFor } from '../lib/pictures.js';

const api = window.projector;

export const lib = $state({ ready: false, songs: [], setlists: [], images: [], imageSets: [], history: [], settings: null });
export const show = $state({
  deck: null,       // { key, kind, title, sub, slides, source }
  focusId: null,    // slide to bring into view in the deck
  live: null,       // { deckKey, index, slide }
  black: false,
  hidden: false,
  output: { open: false, displayId: null },
  displays: [],
  editing: null,    // a song being edited, or null
  toast: null,
  stage: { open: false, displayId: null }, // the pastor's screen
  message: '',      // a line the operator sends to the stage screen only
  startedAt: null,  // when projection started, for the stage screen's timer
});

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- saving ----------
const timers = {};
export function save(section) {
  clearTimeout(timers[section]);
  timers[section] = setTimeout(() => api.library.patch({ [section]: $state.snapshot(lib[section]) }), 250);
}

let toastTimer;
export function toast(text, tone = 'info') {
  show.toast = { text, tone };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (show.toast = null), 3200);
}

export async function init() {
  const data = await api.library.get();
  Object.assign(lib, { songs: data.songs, setlists: data.setlists, images: data.images || [], imageSets: data.imageSets?.length ? data.imageSets : [{ id: 'pictures', name: 'Pictures', imageIds: [] }], history: data.history || [], settings: data.settings });
  migrate();
  lib.ready = true;
  await loadThemeFonts(lib.settings.themes); // measuring needs the real faces, not a fallback
  show.displays = await api.displays.list();
  show.output = await api.output.status();
  show.stage = await api.stage.status();
  api.displays.onChange((d) => (show.displays = d));
  // tell the operator when a screen is plugged in, pulled out, or comes back
  api.displays.onEvent((e) => {
    const what = e.what === 'stage' ? 'stage screen' : 'projector';
    if (e.kind === 'added') toast(`${e.label} connected. Choose it at the top (projector) or in Stage.`, 'ok');
    else if (e.kind === 'lost') toast(`The ${what} screen was disconnected. It comes back by itself when the cable is plugged in again.`, 'bad');
    else if (e.kind === 'back') toast(`The ${what} screen is back${e.label ? ` on ${e.label}` : ''}.`, 'ok');
  });
  api.output.onStatus((s) => (show.output = s));
  api.stage.onStatus((s) => (show.stage = s));
}

// Settings saved by earlier versions get the newer fields.
export function migrate() {
  if (!lib.settings.split || lib.settings.split === 'auto') lib.settings.split = 'fit';
  if (!lib.settings.stage) lib.settings.stage = { displayId: null, showEnglish: true };
  if (lib.settings.linkLooks === undefined) lib.settings.linkLooks = true;
  // The livestream overlay: what the stream shows of Bible and song slides, independent of the room.
  lib.settings.stream = { lan: false, image: 'full', bible: 'reference', song: 'lower', visible: true, autoHide: 0, corner: 'left', accent: '#ffd36b', lang: 'same', speed: 'normal', ...(lib.settings.stream || {}) };
  if (!lib.settings.stream.langV2) { lib.settings.stream.lang = 'same'; lib.settings.stream.langV2 = true; }
  for (const t of Object.values(lib.settings.themes)) {
    if (!t.motion) t.motion = 'fade';
    if (!t.motionSpeed) t.motionSpeed = 'normal';
    if (t.minFit === undefined) t.minFit = 0.85;
    if (t.steady === undefined) t.steady = true;
    if (!t.position) t.position = 'center';
    if (!t.band) t.band = { color: '#000000', opacity: 0.6 };
  }
}

// ---------- looks ----------
// Apply a ready-made look. With linked looks it dresses songs and the Bible together, each in its
// own version of the look; otherwise only the side being edited changes.
export function useLook(preset, kind) {
  const kinds = lib.settings.linkLooks ? ['bible', 'song'] : [kind];
  for (const k of kinds) lib.settings.themes[k] = applyPreset($state.snapshot(lib.settings.themes[k]), preset[k]);
  lib.settings.look = preset.id;
  save('settings');
  toast(`${preset.name} look on ${kinds.length > 1 ? 'songs and Bible' : kind === 'song' ? 'songs' : 'Bible'}`, 'ok');
}

// After an edit on one side: carry the shared parts (background, fonts, colours) to the other side.
export function lookEdited(kind) {
  if (lib.settings.linkLooks) {
    const other = kind === 'song' ? 'bible' : 'song';
    lib.settings.themes[other] = shareLook($state.snapshot(lib.settings.themes[kind]), $state.snapshot(lib.settings.themes[other]));
  }
  lib.settings.look = null;
  save('settings');
}

const buildOpts = (kind) => ({ split: lib.settings.split, theme: $state.snapshot(lib.settings.themes[kind]) });

// ---------- loading decks ----------
export function openBible(book, chapter, verse = null) {
  const slides = chapterSlides(book, chapter, buildOpts('bible'));
  show.deck = {
    key: `b-${book}-${chapter}`, kind: 'bible',
    title: refLabel(book, chapter, null, 'en'), sub: refLabel(book, chapter, null, 'te'),
    slides, source: { type: 'bible', book, chapter },
  };
  show.focusId = verse ? (slides.find((s) => s.verse === verse) || slides[0])?.id : slides[0]?.id;
  show.editing = null;
}

export function openSong(song) {
  show.deck = { key: `s-${song.id}`, kind: 'song', title: song.title, sub: song.author || '', slides: songSlides(song, buildOpts('song')), source: { type: 'song', songId: song.id } };
  show.focusId = show.deck.slides[0]?.id;
  show.editing = null;
}

// Rebuild the open deck (after a look or split change), keeping the focus and the live slide in place.
export function reloadDeck() {
  const d = show.deck;
  if (!d) return;
  const focus = d.slides.find((s) => s.id === show.focusId);
  const wasLive = show.live && show.live.deckKey === d.key ? show.live.slide : null;
  if (d.source.type === 'bible') openBible(d.source.book, d.source.chapter, focus?.verse);
  else { const s = lib.songs.find((x) => x.id === d.source.songId); if (s) openSong(s); else { show.deck = null; return; } }
  if (wasLive) {
    const nd = show.deck;
    // same slide if it still exists, else the first part of the same verse or stanza
    let i = nd.slides.findIndex((s) => s.id === wasLive.id);
    if (i < 0) i = nd.slides.findIndex((s) => (wasLive.verse ? s.verse === wasLive.verse : s.num.startsWith(String(parseInt(wasLive.num, 10)))));
    if (i >= 0) show.live = { ...show.live, index: i, slide: nd.slides[i], slides: nd.slides };
  }
}

let reloadTimer;
export function reloadSoon() { clearTimeout(reloadTimer); reloadTimer = setTimeout(reloadDeck, 150); }

// ---------- the show ----------
export function goLive(index, deck = show.deck) {
  if (!deck || !deck.slides[index]) return;
  show.live = { deckKey: deck.key, deckTitle: deck.title, index, slide: deck.slides[index], slides: deck.slides };
  show.black = false;
  show.hidden = false;
  if (deck === show.deck) show.focusId = deck.slides[index].id;
}

const liveIsLoaded = () => show.live && show.deck && show.live.deckKey === show.deck.key;

// What Space would show: the next slide of the live deck, or the first slide of a newly loaded deck.
export function upcoming() {
  if (!show.deck?.slides.length) return show.live ? show.live.slides[show.live.index + 1] || null : null;
  if (liveIsLoaded()) {
    // a different slide picked in the live deck is what comes next (how pictures are lined up)
    if (show.focusId && show.focusId !== show.live.slide.id) return show.deck.slides.find((s) => s.id === show.focusId) || null;
    return show.deck.slides[show.live.index + 1] || null;
  }
  const f = show.deck.slides.findIndex((s) => s.id === show.focusId);
  return show.deck.slides[Math.max(0, f)] || null;
}

export function next() {
  if (liveIsLoaded() && show.focusId && show.focusId !== show.live.slide.id) {
    const f = show.deck.slides.findIndex((s) => s.id === show.focusId);
    if (f >= 0) return goLive(f);
  }
  if (show.deck && !liveIsLoaded()) {
    const f = show.deck.slides.findIndex((s) => s.id === show.focusId);
    return goLive(Math.max(0, f));
  }
  if (show.live) goLive(Math.min(show.live.index + 1, show.live.slides.length - 1), liveIsLoaded() ? show.deck : { key: show.live.deckKey, title: show.live.deckTitle, slides: show.live.slides });
}

export function prev() {
  if (!show.live) return;
  goLive(Math.max(show.live.index - 1, 0), liveIsLoaded() ? show.deck : { key: show.live.deckKey, title: show.live.deckTitle, slides: show.live.slides });
}

// Typing a number then Enter goes to that verse or slide in the loaded deck.
export function jumpTo(text) {
  const d = show.deck;
  if (!d) return false;
  const i = d.slides.findIndex((s) => s.num === text || String(s.verse) === text || s.num === `${text}a`);
  if (i < 0) { toast(`No ${d.kind === 'bible' ? 'verse' : 'slide'} ${text} here`, 'bad'); return false; }
  goLive(i);
  return true;
}

export const toggleStream = () => { lib.settings.stream.visible = !lib.settings.stream.visible; save('settings'); };
export const toggleBlack = () => (show.black = !show.black);
export const toggleHidden = () => (show.hidden = !show.hidden);
export const bringBack = () => { show.black = false; show.hidden = false; };

export function frameOf(slide) {
  if (!slide || !lib.settings) return null;
  if (slide.kind === 'image') {
    // a picture's adjustments are read fresh, so moving or recolouring it reaches the live screen at once
    const img = lib.images.find((i) => i.id === slide.imageId);
    return { slide: { ...slide, adjust: img?.adjust }, theme: lib.settings.themes.bible };
  }
  return { slide, theme: lib.settings.themes[slide.kind] };
}

// ---------- output window ----------
export async function startOutput() {
  const out = lib.settings.output;
  const pick = out.displayId && show.displays.some((d) => d.id === out.displayId) ? out.displayId : (show.displays.find((d) => !d.primary) || show.displays[0])?.id;
  out.displayId = pick;
  save('settings');
  show.output = await api.output.open(pick, out.mode);
  show.startedAt = show.startedAt || Date.now();
  if (show.displays.length < 2) toast('Only one screen is connected, so the output covers this one. Press Esc on it to close.', 'info');
}
export async function stopOutput() { show.output = await api.output.close(); }

// ---------- stage screen (the pastor's view) ----------
export async function startStage(displayId) {
  const st = lib.settings.stage;
  if (displayId) st.displayId = displayId;
  const taken = show.output.open ? show.output.displayId : null;
  const pick = st.displayId && show.displays.some((d) => d.id === st.displayId) ? st.displayId
    : (show.displays.find((d) => !d.primary && d.id !== taken) || show.displays.find((d) => !d.primary) || show.displays[0])?.id;
  st.displayId = pick;
  save('settings');
  show.stage = await api.stage.open(pick);
  show.startedAt = show.startedAt || Date.now();
  if (show.displays.length < 2) toast('Only one screen is connected, so the stage view covers this one. Press Esc on it to close.', 'info');
  else if (pick === taken) toast('The stage view and the projector are on the same screen. Pick another screen for one of them.', 'bad');
}
export async function stopStage() { show.stage = await api.stage.close(); }

// ---------- service order ----------
export const activeSetlist = () => lib.setlists.find((l) => l.id === lib.settings.activeSetlist) || lib.setlists[0];

export function addToOrder() {
  const d = show.deck;
  const list = activeSetlist();
  if (!d || !list) return;
  if (d.source.type === 'song') {
    if (list.items.some((it) => it.type === 'song' && it.songId === d.source.songId)) return toast('Already in the order');
    list.items.push({ id: uid(), type: 'song', songId: d.source.songId });
  } else if (d.source.type === 'images') {
    if (list.items.some((it) => it.type === 'images' && it.setId === d.source.setId)) return toast('Already in the order');
    list.items.push({ id: uid(), type: 'images', setId: d.source.setId });
  } else {
    const focus = d.slides.find((s) => s.id === show.focusId);
    list.items.push({ id: uid(), type: 'bible', book: d.source.book, chapter: d.source.chapter, verse: focus?.verse || 1 });
  }
  save('setlists');
  toast(`Added to ${list.name}`, 'ok');
}

export function orderLabel(it) {
  if (it.type === 'images') { const set = lib.imageSets.find((x) => x.id === it.setId); return { title: set ? set.name : 'Missing pictures', sub: set ? `${set.imageIds.length} pictures` : '', kind: 'Pictures' }; }
  if (it.type === 'bible') return { title: refLabel(it.book, it.chapter, it.verse, 'en'), sub: refLabel(it.book, it.chapter, it.verse, 'te'), kind: 'Bible' };
  const s = lib.songs.find((x) => x.id === it.songId);
  return { title: s ? s.title : 'Missing song', sub: s?.author || '', kind: 'Song' };
}

export function openItem(it) {
  if (it.type === 'images') { const set = lib.imageSets.find((x) => x.id === it.setId); return set ? openPictures(set) : toast('Those pictures were removed', 'bad'); }
  if (it.type === 'bible') return openBible(it.book, it.chapter, it.verse);
  const s = lib.songs.find((x) => x.id === it.songId);
  if (s) openSong(s); else toast('That song was deleted', 'bad');
}

export function itemIsLive(it) {
  if (!show.live) return false;
  if (it.type === 'images') return show.live.deckKey === `p-${it.setId}`;
  if (it.type === 'song') return show.live.deckKey === `s-${it.songId}`;
  return show.live.deckKey === `b-${it.book}-${it.chapter}`;
}

// ---------- songs ----------
export function saveSong(song, { present = false } = {}) {
  const now = new Date().toISOString();
  const clean = { ...song, id: song.id || uid(), title: (song.title || '').trim() || 'Untitled', updatedAt: now };
  const i = lib.songs.findIndex((s) => s.id === clean.id);
  if (i >= 0) lib.songs[i] = clean; else lib.songs.unshift(clean);
  save('songs');
  openSong(lib.songs.find((s) => s.id === clean.id));
  if (present) goLive(0);
  toast(present ? `"${clean.title}" is on screen` : 'Song saved', 'ok');
}

export const newSong = (lyrics = '', title = '', author = '') => ({ id: '', title, author, lyrics, english: '', options: { repeat: true, marks: 'keep', second: 'show' } });

export function deleteSong(id) {
  lib.songs = lib.songs.filter((s) => s.id !== id);
  for (const l of lib.setlists) l.items = l.items.filter((it) => !(it.type === 'song' && it.songId === id));
  save('songs'); save('setlists');
  if (show.deck?.source.songId === id) show.deck = null;
  show.editing = null;
}

// ---------- pictures ----------
export const activeImageSet = () => lib.imageSets.find((x) => x.id === lib.settings.activeImageSet) || lib.imageSets[0];
export const pictureById = (id) => lib.images.find((i) => i.id === id);

export function pictureSlides(set) {
  return (set?.imageIds || []).map(pictureById).filter(Boolean).map((img, i) => ({
    id: `i-${img.id}`, kind: 'image', imageId: img.id, url: img.url, num: String(i + 1),
    te: '', en: '', refTe: img.name, refEn: img.name, label: img.name,
  }));
}

export function openPictures(set = activeImageSet(), focusImageId = null) {
  if (!set) return;
  lib.settings.activeImageSet = set.id;
  const slides = pictureSlides(set);
  show.deck = { key: `p-${set.id}`, kind: 'image', title: set.name, sub: '', slides, source: { type: 'images', setId: set.id } };
  show.focusId = focusImageId ? `i-${focusImageId}` : (show.live?.deckKey === show.deck.key ? show.live.slide.id : slides[0]?.id);
  show.editing = null;
}

// Add pictures (pasted, chosen, dropped or downloaded) to the open set, then show that set.
export function addPictures(items) {
  if (!items?.length) return;
  const set = activeImageSet();
  const added = items.map((it) => ({ id: uid(), url: it.url, name: it.name || 'Picture', credit: it.credit || '', source: it.source || 'file', page: it.page || '', adjust: { ...DEFAULT_ADJUST } }));
  lib.images.push(...added);
  set.imageIds.push(...added.map((a) => a.id));
  save('images'); save('imageSets');
  // look at each picture once: a tall one starts as 'whole picture' instead of being cropped
  for (const a of added) {
    const im = new Image();
    im.onload = () => {
      const img = lib.images.find((x) => x.id === a.id);
      if (!img) return;
      img.w = im.naturalWidth; img.h = im.naturalHeight;
      img.adjust = { ...img.adjust, ...fitFor(im.naturalWidth, im.naturalHeight) };
      save('images');
    };
    im.src = a.url;
  }
  openPictures(set, added[0].id);
  toast(`${added.length === 1 ? `"${added[0].name}"` : `${added.length} pictures`} added to ${set.name}`, 'ok');
}

export function removePicture(imageId) {
  const set = activeImageSet();
  set.imageIds = set.imageIds.filter((id) => id !== imageId);
  // forget the picture once no set uses it
  if (!lib.imageSets.some((x) => x.imageIds.includes(imageId))) lib.images = lib.images.filter((i) => i.id !== imageId);
  save('images'); save('imageSets');
  if (show.deck?.kind === 'image') openPictures(set);
}

export function movePicture(from, to) {
  const set = activeImageSet();
  const [x] = set.imageIds.splice(from, 1);
  set.imageIds.splice(to, 0, x);
  save('imageSets');
  openPictures(set, x);
}

export function newPictureSet(name) {
  const set = { id: uid(), name: name.trim() || 'Pictures', imageIds: [] };
  lib.imageSets.push(set);
  lib.settings.activeImageSet = set.id;
  save('imageSets'); save('settings');
  openPictures(set);
}

// Picture files from the clipboard or a drop become pictures in the open set.
export async function addPictureFiles(files, source = 'paste') {
  const out = [];
  for (const f of files) {
    try {
      const saved = await api.pictures.save(f.name || 'pasted picture', new Uint8Array(await f.arrayBuffer()), f.type);
      out.push({ ...saved, source });
    } catch (e) { toast(String(e.message || e), 'bad'); }
  }
  addPictures(out);
}

// ---------- history: verses kept with a double-click, each with its own note ----------
const verseOf = (slide) => {
  if (!slide || slide.kind !== 'bible') return null;
  const [, book, chapter, verse] = slide.id.split('-').map(Number);
  return { book, chapter, verse };
};

export function addToHistory(slideOrRef) {
  const v = slideOrRef?.kind ? verseOf(slideOrRef) : slideOrRef;
  if (!v?.book) return;
  const i = lib.history.findIndex((h) => h.book === v.book && h.chapter === v.chapter && h.verse === v.verse);
  // already kept: move it to the top and keep its note
  const item = i >= 0 ? lib.history.splice(i, 1)[0] : { id: uid(), book: v.book, chapter: v.chapter, verse: v.verse, note: '' };
  item.at = new Date().toISOString();
  lib.history.unshift(item);
  if (lib.history.length > 300) lib.history.length = 300;
  save('history');
  toast(i >= 0 ? `${refLabel(v.book, v.chapter, v.verse, 'en')} moved to the top of History` : `${refLabel(v.book, v.chapter, v.verse, 'en')} added to History`, 'ok');
}

export function renameHistory(id, note) {
  const h = lib.history.find((x) => x.id === id);
  if (!h) return;
  h.note = note.trim().slice(0, 120);
  save('history');
}

export function removeHistory(id) {
  lib.history = lib.history.filter((h) => h.id !== id);
  save('history');
}

export function clearHistory() {
  lib.history = [];
  save('history');
}

export function historyToOrder(h) {
  const list = activeSetlist();
  list.items.push({ id: uid(), type: 'bible', book: h.book, chapter: h.chapter, verse: h.verse, note: h.note || '' });
  save('setlists');
  toast(`Added to ${list.name}`, 'ok');
}

// ---------- the stage screen's frame (the stage window and its preview in the Stage tab) ----------
export function stageFrame() {
  const f = frameOf(show.live?.slide);
  const theme = f?.theme || lib.settings.themes.bible;
  return {
    live: show.live?.slide || null, next: upcoming(), deckTitle: show.live?.deckTitle || show.deck?.title || '',
    black: show.black, hidden: show.hidden, message: show.message, startedAt: show.startedAt,
    showEnglish: lib.settings.stage?.showEnglish !== false,
    textSize: lib.settings.stage?.textSize || 1,
    // the languages the projector is showing for this slide (Telugu only, English only, both)
    layout: theme.layout || 'both',
    // what the stage monitor shows: the pastor view, or exactly what the projector shows
    view: lib.settings.stage?.view || 'pastor',
    screen: { ...(f || {}), theme, black: show.black, hidden: show.hidden },
  };
}

// S: switch how long verses are handled for the open passage, without opening any menu
export function toggleSplit() {
  lib.settings.split = lib.settings.split === 'none' ? 'fit' : 'none';
  save('settings');
  reloadDeck();
  toast(lib.settings.split === 'none' ? 'Long verses now shrink to fit on one slide' : 'Long verses now continue on a new slide', 'ok');
}

// ---------- the phone remote ----------
// What a phone sees: the screen as the room sees it, and the open item's slides to tap.
export function remoteFrame() {
  const f = frameOf(show.live?.slide);
  const d = show.deck;
  const nx = upcoming();
  return {
    screen: { ...(f || {}), theme: f?.theme || lib.settings.themes.bible, black: show.black, hidden: show.hidden },
    live: show.live ? { refEn: show.live.slide.refEn, refTe: show.live.slide.refTe, kind: show.live.slide.kind } : null,
    next: nx ? { refEn: nx.refEn } : null,
    deck: d ? { title: d.title, slides: d.slides.slice(0, 800).map((s, i) => ({ i, num: s.num, line: (s.kind === 'image' ? s.label : (s.te || s.en || '').split('\n')[0]).slice(0, 90) })) } : null,
    deckIsLive: !!(d && show.live && show.live.deckKey === d.key),
    liveIndex: show.live ? show.live.index : null,
    black: show.black, hidden: show.hidden,
  };
}

// A command from the phone (already checked against the PIN by the main process).
export function remoteCommand({ action, index }) {
  if (action === 'next') next();
  else if (action === 'prev') prev();
  else if (action === 'black') toggleBlack();
  else if (action === 'hide') toggleHidden();
  else if (action === 'back') bringBack();
  else if (action === 'stream') toggleStream();
  else if (action === 'go' && show.deck && show.deck.slides[index]) goLive(index);
}
