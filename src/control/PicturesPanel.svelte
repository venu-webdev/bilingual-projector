<script>
  // Pictures in the library column: the sets, the ways in (paste, choose, drop, find), and search
  // suggested from the verse being read, on Wikimedia Commons (openly licensed photographs).
  import { lib, show, save, activeImageSet, openPictures, addPictures, newPictureSet, toast } from './state.svelte.js';
  import { getBooks, verseText } from '../lib/bible.js';
  import { pictureWords } from '../lib/pictures.js';
  import Icon from './Icon.svelte';

  const set = $derived(activeImageSet());
  let naming = $state(false);
  let name = $state('');

  // The verse the suggestions come from: the one on screen, else the one picked in the open chapter,
  // else the last one seen, so opening a picture set does not lose them.
  let lastVerse = null;
  const verse = $derived.by(() => {
    const s = show.live?.slide?.kind === 'bible' ? show.live.slide : show.deck?.kind === 'bible' ? show.deck.slides.find((x) => x.id === show.focusId) : null;
    if (!s) return lastVerse;
    const [, n, c, v] = s.id.split('-').map(Number);
    lastVerse = { ref: s.refEn, en: verseText(n, c, v)[1] };
    return lastVerse;
  });
  const words = $derived(verse ? pictureWords(verse.en, getBooks()) : []);

  let q = $state('');
  let results = $state([]);
  let busy = $state(false);
  let failed = $state('');
  let getting = $state(new Set());

  async function find(text = q) {
    q = text.trim();
    if (!q) return;
    busy = true; failed = '';
    try { results = await window.projector.pictures.search(q); if (!results.length) failed = 'No photographs found. Try one plain word: river, shepherd, bread, cross, sunrise.'; }
    catch (e) { results = []; failed = navigator.onLine ? `Search did not work: ${e.message || e}` : 'No internet. Pictures you already added still work.'; }
    busy = false;
  }

  async function take(r) {
    getting = new Set([...getting, r.full]);
    try {
      const saved = await window.projector.pictures.download({ url: r.full, title: r.title });
      addPictures([{ ...saved, name: r.title.slice(0, 60), credit: r.credit, page: r.page, source: 'commons' }]);
    } catch (e) { toast(String(e.message || e), 'bad'); }
    const g = new Set(getting); g.delete(r.full); getting = g;
  }

  async function choose() {
    const files = await window.projector.pictures.choose();
    addPictures(files.map((f) => ({ ...f, source: 'file' })));
  }

  function create() {
    if (name.trim()) newPictureSet(name);
    naming = false; name = '';
  }
</script>

<div class="pp">
  <div class="sets">
    {#if naming}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="field" autofocus placeholder="Set name, e.g. Holy Land" bind:value={name} onkeydown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') naming = false; }} onblur={create} />
    {:else}
      <select class="field" aria-label="Picture set" value={set?.id} onchange={(e) => { lib.settings.activeImageSet = e.currentTarget.value; save('settings'); openPictures(activeImageSet()); }}>
        {#each lib.imageSets as s (s.id)}<option value={s.id}>{s.name} ({s.imageIds.length})</option>{/each}
      </select>
      <button class="btn btn--sm btn--icon" aria-label="New picture set" title="New picture set" onclick={() => (naming = true)}><Icon name="plus" /></button>
    {/if}
  </div>
  <div class="ways">
    <button class="btn btn--sm" onclick={() => openPictures(set)}><Icon name="image" />Open set</button>
    <button class="btn btn--sm" onclick={choose}><Icon name="plus" />Add files…</button>
  </div>
  <p class="tip">Or copy a picture anywhere and press <kbd>Ctrl V</kbd>, or drag picture files onto the app.</p>

  <div class="find">
    <h3>Find pictures</h3>
    {#if words.length}
      <div class="for">For {verse.ref}:</div>
      <div class="chips">
        {#each words as w}<button class="chip-btn" onclick={() => find(w)}>{w}</button>{/each}
        {#if words.length > 1}<button class="chip-btn all" onclick={() => find(words.slice(0, 2).join(' '))}>{words.slice(0, 2).join(' + ')}</button>{/if}
      </div>
    {:else}
      <div class="for">Open a Bible passage and the words worth searching appear here.</div>
    {/if}
    <div class="search">
      <Icon name="search" />
      <input class="field" placeholder="shepherd, river, bread, sunrise…" bind:value={q} onkeydown={(e) => { if (e.key === 'Enter') find(); }} aria-label="Search pictures" />
    </div>
  </div>

  <div class="results">
    {#if busy}
      <div class="empty">Searching Wikimedia Commons…</div>
    {:else if failed}
      <div class="empty">{failed}</div>
    {:else if results.length}
      <div class="grid">
        {#each results as r (r.full)}
          <button class="res" onclick={() => take(r)} disabled={getting.has(r.full)} title={`${r.title}\n${r.credit}\nClick to add to ${set?.name}`}>
            <img src={r.thumb} alt={r.title} loading="lazy" />
            <span class="add">{getting.has(r.full) ? 'Adding…' : '+ Add'}</span>
          </button>
        {/each}
      </div>
      <p class="credit">Photographs from Wikimedia Commons, openly licensed. Each one keeps its author and licence.</p>
    {/if}
  </div>
</div>

<style>
  .pp { display: flex; flex-direction: column; min-height: 0; flex: 1; overflow-y: auto; padding: 12px 14px; gap: 10px; }
  .sets { display: flex; gap: 6px; }
  .sets .field { height: 32px; }
  .ways { display: flex; gap: 6px; }
  .tip { margin: -2px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
  .find { border-top: 1px solid var(--rule); padding-top: 10px; display: grid; gap: 8px; }
  h3 { margin: 0; font-size: 13px; font-weight: 600; }
  .for { color: var(--muted); font-size: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip-btn { height: 26px; padding: 0 10px; border: 1px solid var(--next-line); border-radius: 13px; background: var(--next-soft); color: var(--next); font-size: 12px; font-weight: 500; cursor: pointer; }
  .chip-btn.all { border-style: dashed; }
  .search { position: relative; }
  .search .field { padding-left: 32px; }
  .search > :global(svg) { position: absolute; left: 10px; top: 9px; width: 16px; height: 16px; color: var(--muted); }
  .results { min-height: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .res { position: relative; aspect-ratio: 4 / 3; padding: 0; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: var(--paper-3); cursor: pointer; }
  .res img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .res .add { position: absolute; right: 4px; bottom: 4px; padding: 2px 7px; border-radius: 4px; background: rgb(0 0 0 / 0.72); color: #fff; font-size: 11px; font-weight: 600; opacity: 0; transition: opacity var(--fast); }
  .res:hover .add, .res:disabled .add, .res:focus-visible .add { opacity: 1; }
  .res:hover { border-color: var(--next); }
  .credit { margin: 8px 0 0; color: var(--muted); font-size: 11px; }
</style>
