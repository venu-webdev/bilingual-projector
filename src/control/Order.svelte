<script>
  // The bottom of the library column: the service order (planned ahead) and History (verses kept
  // during the service with a double-click, each with a note saying what it was for).
  import { lib, show, save, uid, activeSetlist, orderLabel, openItem, itemIsLive, toast, openBible, goLive, renameHistory, removeHistory, clearHistory, historyToOrder } from './state.svelte.js';
  import { refLabel } from '../lib/bible.js';
  import Icon from './Icon.svelte';

  let view = $state('order'); // order | history
  const list = $derived(activeSetlist());
  let dragFrom = $state(-1);
  let dragOver = $state(-1);
  let naming = $state(false);
  let name = $state('');
  let editing = $state(null); // the history item being renamed
  let draft = $state('');

  // jump to History when a verse is kept, so the operator sees it land
  let seen = lib.history.length;
  $effect(() => { if (lib.history.length > seen) view = 'history'; seen = lib.history.length; });

  function create() {
    const n = name.trim();
    if (!n) { naming = false; return; }
    const l = { id: uid(), name: n, items: [] };
    lib.setlists.push(l);
    lib.settings.activeSetlist = l.id;
    save('setlists'); save('settings');
    naming = false; name = '';
  }
  function remove(i) {
    list.items.splice(i, 1);
    save('setlists');
  }
  function removeList() {
    if (lib.setlists.length < 2) { list.items = []; save('setlists'); toast('Order cleared'); return; }
    if (!confirm(`Delete "${list.name}"? Its ${list.items.length} items go with it.`)) return;
    lib.setlists = lib.setlists.filter((l) => l.id !== list.id);
    lib.settings.activeSetlist = lib.setlists[0].id;
    save('setlists'); save('settings');
  }
  function drop(i) {
    if (dragFrom < 0 || dragFrom === i) { dragFrom = dragOver = -1; return; }
    const [it] = list.items.splice(dragFrom, 1);
    list.items.splice(i, 0, it);
    save('setlists');
    dragFrom = dragOver = -1;
  }

  const startRename = (h) => { editing = h.id; draft = h.note || ''; };
  const finishRename = () => { if (editing) renameHistory(editing, draft); editing = null; };
  const when = (iso) => { const d = new Date(iso); const today = new Date().toDateString() === d.toDateString(); return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' }); };
  const isLiveVerse = (h) => show.live?.slide?.id?.startsWith(`b-${h.book}-${h.chapter}-${h.verse}-`);
  function showVerse(h) {
    openBible(h.book, h.chapter, h.verse);
    const i = show.deck.slides.findIndex((s) => s.verse === h.verse);
    if (i >= 0) goLive(i);
  }
</script>

<div class="order">
  <div class="switch" role="tablist" aria-label="Plan or history">
    <button role="tab" aria-selected={view === 'order'} onclick={() => (view = 'order')}>Service order <span class="mono">{list?.items.length || 0}</span></button>
    <button role="tab" aria-selected={view === 'history'} onclick={() => (view = 'history')}>History <span class="mono">{lib.history.length}</span></button>
  </div>

  {#if view === 'order'}
    <div class="head">
      {#if naming}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="field" autofocus placeholder="Name, e.g. Sunday 23 Nov" bind:value={name} onkeydown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') naming = false; }} onblur={create} />
      {:else}
        <select class="pick" aria-label="Service order" value={list?.id} onchange={(e) => { lib.settings.activeSetlist = e.currentTarget.value; save('settings'); }}>
          {#each lib.setlists as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
        </select>
        <button class="btn btn--sm btn--icon btn--quiet" aria-label="New service order" title="New service order" onclick={() => (naming = true)}><Icon name="plus" /></button>
        <button class="btn btn--sm btn--icon btn--quiet" aria-label="Delete this service order" title="Delete this service order" onclick={removeList}><Icon name="trash" /></button>
      {/if}
    </div>
    <ol class="items">
      {#each list?.items || [] as it, i (it.id)}
        {@const l = orderLabel(it)}
        <li
          class="item" class:live={itemIsLive(it)} class:over={dragOver === i}
          draggable="true"
          ondragstart={() => (dragFrom = i)}
          ondragover={(e) => { e.preventDefault(); dragOver = i; }}
          ondragleave={() => { if (dragOver === i) dragOver = -1; }}
          ondrop={() => drop(i)}
          ondragend={() => (dragFrom = dragOver = -1)}
        >
          <button class="open" onclick={() => openItem(it)}>
            <span class="n mono">{i + 1}</span>
            <span class="t"><span class="title">{it.note ? `${it.note} · ${l.title}` : l.title}</span><span class="sub" class:te={it.type === 'bible'}>{itemIsLive(it) ? 'On screen' : l.sub || l.kind}</span></span>
          </button>
          <button class="x" aria-label={`Remove ${l.title}`} onclick={() => remove(i)}><Icon name="close" /></button>
        </li>
      {:else}
        <li class="empty">Open a passage or a song, then press <b style="display:inline">Add to order</b> to plan the service.</li>
      {/each}
    </ol>
  {:else}
    <div class="head">
      <span class="hint">Double-click a verse to keep it here. ✎ names it.</span>
      {#if lib.history.length}<button class="btn btn--sm btn--quiet" onclick={() => { if (confirm(`Clear all ${lib.history.length} verses from History?`)) clearHistory(); }}>Clear</button>{/if}
    </div>
    <ol class="items">
      {#each lib.history as h (h.id)}
        <li class="item hist" class:live={isLiveVerse(h)}>
          {#if editing === h.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="field rename" autofocus placeholder="What is this verse for? e.g. Pastor's opening" bind:value={draft}
              onkeydown={(e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') editing = null; }} onblur={finishRename} />
          {:else}
            <button class="open" onclick={() => showVerse(h)} ondblclick={() => startRename(h)} title="Click to show it. Double-click to name it.">
              <span class="n mono">{when(h.at)}</span>
              <span class="t">
                <span class="title">{h.note || refLabel(h.book, h.chapter, h.verse, 'en')}</span>
                <span class="sub">{h.note ? `${refLabel(h.book, h.chapter, h.verse, 'en')} · ` : ''}<span class="te">{refLabel(h.book, h.chapter, h.verse, 'te')}</span>{isLiveVerse(h) ? ' · On screen' : ''}</span>
              </span>
            </button>
            <button class="act" aria-label={`Name ${refLabel(h.book, h.chapter, h.verse, 'en')}`} title="Name it" onclick={() => startRename(h)}>✎</button>
            <button class="act" aria-label="Add to the service order" title="Add to the service order" onclick={() => historyToOrder(h)}><Icon name="plus" /></button>
            <button class="x" aria-label="Remove from History" onclick={() => removeHistory(h.id)}><Icon name="close" /></button>
          {/if}
        </li>
      {:else}
        <li class="empty">Double-click any verse (in the slides or the search results) and it is kept here with the time. Name each one so you remember what it was for.</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .order { flex: none; max-height: 42%; display: flex; flex-direction: column; border-top: 1px solid var(--rule); background: var(--paper); }
  .switch { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; margin: 8px 10px 0; background: var(--paper-3); border: 1px solid var(--rule); border-radius: var(--r-ctl); flex: none; }
  .switch button { height: 28px; border: 0; border-radius: 4px; background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; cursor: pointer; }
  .switch button[aria-selected="true"] { background: var(--paper-2); color: var(--ink); box-shadow: inset 0 0 0 1px var(--rule-2); }
  .switch .mono { font-size: 11px; color: var(--muted); margin-left: 3px; }
  .head { display: flex; align-items: center; gap: 4px; min-height: 42px; padding: 0 8px 0 10px; border-bottom: 1px solid var(--rule); flex: none; }
  .head .field { height: 32px; }
  .hint { flex: 1; color: var(--muted); font-size: 12px; padding-left: 4px; }
  .pick { flex: 1; min-width: 0; height: 32px; border: 0; background: transparent; font-weight: 600; font-size: 14px; cursor: pointer; padding: 0 4px; }
  .pick option { background: var(--paper-2); font-weight: 400; }
  .items { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; min-height: 0; }
  .item { display: flex; align-items: center; border-top: 2px solid transparent; }
  .item:hover { background: var(--paper-2); }
  .item.over { border-top-color: var(--next); }
  .item.live { background: var(--live-soft); }
  .open { flex: 1; min-width: 0; display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 6px; padding: 6px 4px 6px 14px; border: 0; background: transparent; cursor: pointer; text-align: left; }
  .hist .open { grid-template-columns: 52px 1fr; }
  .n { color: var(--muted); font-size: 11px; }
  .t { min-width: 0; }
  .title { display: block; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { display: block; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .live .n, .live .sub { color: var(--live); }
  .x, .act { width: 28px; height: 28px; border: 0; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; opacity: 0; font-size: 14px; flex: none; }
  .x { margin-right: 6px; }
  .x :global(svg), .act :global(svg) { width: 13px; height: 13px; }
  .item:hover .x, .item:hover .act, .x:focus-visible, .act:focus-visible { opacity: 1; }
  .x:hover, .act:hover { background: var(--rule); color: var(--ink); }
  .rename { margin: 4px 10px; height: 32px; }
  .empty { padding: 14px 16px; font-size: 12px; text-align: left; color: var(--muted); }
</style>
