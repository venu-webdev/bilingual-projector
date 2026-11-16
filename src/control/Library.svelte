<script>
  import { getBooks, parseReference, searchWords, suggestBooks, verseText, refLabel } from '../lib/bible.js';
  import { lib, show, openBible, openSong, goLive, newSong, addToHistory } from './state.svelte.js';
  import Icon from './Icon.svelte';
  import ThemeEditor from './ThemeEditor.svelte';
  import PicturesPanel from './PicturesPanel.svelte';

  let { search = $bindable(null) } = $props();

  let tab = $state('bible');
  let q = $state('');
  let songQ = $state('');
  let browseBook = $state(null);
  let active = $state(0); // keyboard position in the results

  const books = getBooks();

  const ref = $derived(/\d/.test(q) ? parseReference(q) : null);
  const bookHits = $derived(q && !/\d/.test(q) ? suggestBooks(q, 6) : []);
  // Word search only runs when the text is not a reference.
  let words = $state({ hits: [], total: 0 });
  let timer;
  $effect(() => {
    const text = q.trim();
    clearTimeout(timer);
    if (ref || text.length < 2) { words = { hits: [], total: 0 }; return; }
    timer = setTimeout(() => (words = searchWords(text)), 90);
  });
  $effect(() => { void q; active = 0; });

  const results = $derived([
    ...(ref && !ref.error ? [{ kind: 'ref', ...ref }] : []),
    ...words.hits.map((h) => ({ kind: 'verse', ...h })),
  ]);

  function choose(r, live = false) {
    openBible(r.book, r.chapter, r.verse);
    if (live) { const i = show.deck.slides.findIndex((s) => s.id === show.focusId); goLive(Math.max(0, i)); }
  }

  function onSearchKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); scrollActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); scrollActive(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active], e.ctrlKey || e.shiftKey);
      else if (bookHits[0]) { browseBook = bookHits[0].n; q = ''; }
    }
  }
  let listEl = $state(null);
  const scrollActive = () => queueMicrotask(() => listEl?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));

  const songs = $derived.by(() => {
    const t = songQ.trim().toLowerCase();
    const all = lib.songs;
    if (!t) return all;
    return all.filter((s) => s.title.toLowerCase().includes(t) || (s.lyrics || '').toLowerCase().includes(t) || (s.english || '').toLowerCase().includes(t));
  });
  const firstLine = (s) => (s.lyrics || '').split('\n').find((l) => l.trim()) || '';
  const startSong = () => (show.editing = newSong());
</script>

<div class="tabs" role="tablist" aria-label="Library">
  <button role="tab" aria-selected={tab === 'bible'} onclick={() => (tab = 'bible')}>Bible</button>
  <button role="tab" aria-selected={tab === 'songs'} onclick={() => (tab = 'songs')}>Songs <span class="n mono">{lib.songs.length}</span></button>
  <button role="tab" aria-selected={tab === 'pictures'} onclick={() => (tab = 'pictures')}>Pictures <span class="n mono">{lib.images.length}</span></button>
  <button role="tab" aria-selected={tab === 'theme'} onclick={() => (tab = 'theme')}>Look</button>
</div>

{#if tab === 'bible'}
  <div class="search">
    <Icon name="search" />
    <input bind:this={search} class="field" type="text" placeholder="jn 3 16, a word, or a book" bind:value={q} onkeydown={onSearchKey} aria-label="Search the Bible" spellcheck="false" />
    {#if q}<button class="clear" aria-label="Clear" onclick={() => { q = ''; search?.focus(); }}><Icon name="close" /></button>{/if}
  </div>

  <div class="scroll" bind:this={listEl}>
    {#if q}
      {#if ref?.error}
        <div class="empty"><b>Not in this book</b>{ref.error}.</div>
      {/if}
      {#if bookHits.length}
        <div class="group">Books</div>
        <div class="bookhits">
          {#each bookHits as b (b.n)}
            <button class="btn btn--sm" onclick={() => { browseBook = b.n; q = ''; }}>{b.en} <span class="te muted">{b.teShort}</span></button>
          {/each}
        </div>
      {/if}
      {#each results as r, i (r.kind + r.book + '-' + r.chapter + '-' + r.verse)}
        {@const t = r.verse ? verseText(r.book, r.chapter, r.verse) : verseText(r.book, r.chapter, 1)}
        {#if i === 0 && r.kind === 'ref'}<div class="group"><span>Reference</span><span><kbd>Enter</kbd> open · <kbd>Ctrl Enter</kbd> show</span></div>{/if}
        {#if r.kind === 'verse' && (i === 0 || results[i - 1].kind === 'ref')}<div class="group"><span>Verses with "{q.trim()}"</span><span class="mono">{words.total > words.hits.length ? `${words.hits.length} of ${words.total}` : words.total}</span></div>{/if}
        <button class="hit" data-active={i === active} onclick={() => choose(r)} ondblclick={() => { choose(r, true); addToHistory({ book: r.book, chapter: r.chapter, verse: r.verse || 1 }); }} title="Click to open. Double-click to show it and keep it in History.">
          <span class="hit__ref">{refLabel(r.book, r.chapter, r.verse, 'en', r.verseEnd)}<span class="te muted">{refLabel(r.book, r.chapter, r.verse, 'te', r.verseEnd)}</span></span>
          <span class="hit__te te">{t[0]}</span>
          <span class="hit__en">{t[1]}</span>
        </button>
      {/each}
      {#if !ref && !bookHits.length && !words.total && q.trim().length >= 2}
        <div class="empty"><b>Nothing found</b>Try fewer words, a shorter Telugu stem, or a reference like <span class="mono">ps 23</span>.</div>
      {/if}
    {:else if browseBook}
      {@const b = books[browseBook - 1]}
      <div class="crumb">
        <button class="btn btn--sm btn--quiet" onclick={() => (browseBook = null)}><Icon name="left" />All books</button>
        <span class="crumb__t">{b.en} <span class="te muted">{b.te}</span></span>
      </div>
      <div class="chapters">
        {#each b.ch as _, c}
          <button class="cell mono" onclick={() => openBible(b.n, c + 1)}>{c + 1}</button>
        {/each}
      </div>
    {:else}
      {#each [['Old Testament', books.slice(0, 39)], ['New Testament', books.slice(39)]] as [label, list]}
        <div class="group">{label}</div>
        <div class="books">
          {#each list as b (b.n)}
            <button class="book" onclick={() => (browseBook = b.n)} title={b.te}><span>{b.en}</span><span class="te">{b.teShort}</span></button>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{:else if tab === 'songs'}
  <div class="search">
    <Icon name="search" />
    <input bind:this={search} class="field" type="text" placeholder="Title or a line of the song" bind:value={songQ} aria-label="Search songs" spellcheck="false" />
  </div>
  <div class="row-actions">
    <button class="btn btn--sm btn--live" onclick={startSong}><Icon name="plus" />Paste a song</button>
    <span class="tip">or press <kbd>Ctrl V</kbd> anywhere</span>
  </div>
  <div class="scroll">
    {#each songs as s (s.id)}
      <div class="song" class:on={show.deck?.source.songId === s.id}>
        <button class="song__main" onclick={() => openSong(s)}>
          <span class="song__t">{s.title}</span>
          <span class="song__l te">{firstLine(s)}</span>
        </button>
        <button class="btn btn--sm btn--icon btn--quiet" aria-label={`Edit ${s.title}`} onclick={() => (show.editing = $state.snapshot(s))}><Icon name="edit" /></button>
      </div>
    {:else}
      <div class="empty">
        {#if songQ}<b>No song matches</b>Check the spelling, or search a line from the song.{:else}<b>No songs yet</b>Copy a song's lyrics from anywhere and press Ctrl V, or import your old app's backup from the ⋯ menu.{/if}
      </div>
    {/each}
  </div>
{:else if tab === 'pictures'}
  <PicturesPanel />
{:else}
  <div class="scroll"><ThemeEditor /></div>
{/if}

<style>
  .tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 3px; margin: 12px 14px 0; background: var(--paper-3); border: 1px solid var(--rule); border-radius: var(--r-ctl); flex: none; }
  .tabs button { height: 28px; border: 0; border-radius: 4px; background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; cursor: pointer; }
  .tabs button[aria-selected="true"] { background: var(--paper-2); color: var(--ink); box-shadow: inset 0 0 0 1px var(--rule-2); }
  .tabs .n { font-size: 11px; color: var(--muted); margin-left: 2px; }
  .search { position: relative; margin: 12px 14px 8px; flex: none; }
  .search .field { height: 40px; padding-left: 34px; font-size: 15px; }
  .search > :global(svg) { position: absolute; left: 11px; top: 12px; width: 16px; height: 16px; color: var(--muted); }
  .clear { position: absolute; right: 6px; top: 6px; width: 28px; height: 28px; border: 0; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; border-radius: 4px; }
  .clear :global(svg) { width: 14px; height: 14px; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 8px; }
  .group { display: flex; justify-content: space-between; gap: 8px; padding: 10px 14px 4px; color: var(--muted); font-size: 12px; font-weight: 500; }
  .group kbd { font-size: 10px; }
  .hit { display: block; width: 100%; text-align: left; padding: 8px 14px; border: 0; border-left: 2px solid transparent; background: transparent; cursor: pointer; }
  .hit:hover, .hit[data-active="true"] { background: var(--paper-2); }
  .hit[data-active="true"] { border-left-color: var(--next); }
  .hit__ref { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; font-size: 13px; }
  .hit__ref .te { font-weight: 400; }
  .hit__te, .hit__en { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; }
  .hit__te { color: var(--ink-2); margin-top: 2px; }
  .hit__en { color: var(--muted); font-size: 12px; }
  .bookhits { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 14px 4px; }
  .books { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; padding: 0 10px; }
  .book { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; cursor: pointer; text-align: left; font-size: 13px; }
  .book:hover { background: var(--paper-2); }
  .book .te { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .crumb { display: flex; align-items: center; gap: 8px; padding: 4px 10px; }
  .crumb__t { font-weight: 600; }
  .chapters { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 4px; padding: 6px 14px; }
  .cell { height: 36px; border: 1px solid var(--rule); border-radius: var(--r-ctl); background: var(--paper-2); cursor: pointer; font-size: 13px; }
  .cell:hover { border-color: var(--next-line); color: var(--next); }
  .row-actions { padding: 0 14px 6px; flex: none; display: flex; align-items: center; gap: 10px; }
  .tip { color: var(--muted); font-size: 12px; }
  .song { display: flex; align-items: center; padding-right: 8px; border-left: 2px solid transparent; }
  .song:hover { background: var(--paper-2); }
  .song.on { border-left-color: var(--next); background: var(--paper-2); }
  .song__main { flex: 1; min-width: 0; text-align: left; padding: 8px 12px; border: 0; background: transparent; cursor: pointer; }
  .song__t { display: block; font-weight: 600; font-size: 13px; }
  .song__l { display: block; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
