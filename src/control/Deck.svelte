<script>
  import { lib, show, save, goLive, upcoming, addToOrder, reloadDeck, addToHistory } from './state.svelte.js';
  import Icon from './Icon.svelte';
  import PictureDeck from './PictureDeck.svelte';

  let scroller = $state(null);
  const nextSlide = $derived(upcoming());
  const liveId = $derived(show.live?.slide.id);

  // Bring the focused slide into view when a deck opens or the live slide moves.
  $effect(() => {
    const id = show.focusId;
    if (!id || !scroller) return;
    queueMicrotask(() => scroller?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
  });
  $effect(() => {
    void show.deck?.key;
    queueMicrotask(() => scroller?.querySelector(`[data-id="${CSS.escape(show.focusId || '')}"]`)?.scrollIntoView({ block: 'center' }));
  });

  const song = $derived(show.deck?.kind === 'song' ? lib.songs.find((s) => s.id === show.deck.source.songId) : null);
</script>

{#if show.deck?.kind === 'image'}
  <PictureDeck />
{:else if show.deck}
  <div class="head">
    <div class="title">
      <span class="t">{show.deck.title}</span>
      {#if show.deck.sub}<span class="sub" class:te={show.deck.kind === 'bible'}>{show.deck.sub}</span>{/if}
      <span class="meta mono">{show.deck.slides.length} slides</span>
    </div>
    <div class="tools">
      {#if show.deck.kind === 'bible'}
        <select class="field small" aria-label="Long verses" value={lib.settings.split} onchange={(e) => { lib.settings.split = e.currentTarget.value; save('settings'); reloadDeck(); }}>
          <option value="fit">Long verses continue on a new slide</option>
          <option value="none">Long verses shrink to fit</option>
        </select>
      {:else if song}
        <button class="btn btn--sm" onclick={() => (show.editing = $state.snapshot(song))}><Icon name="edit" />Edit song</button>
      {/if}
      <button class="btn btn--sm" onclick={addToOrder}><Icon name="plus" />Add to order</button>
    </div>
  </div>
  <div class="scroll" bind:this={scroller}>
    <ol class="slides">
      {#each show.deck.slides as s, i (s.id)}
        <li>
          <button
            class="slide" class:live={s.id === liveId} class:next={s.id === nextSlide?.id && s.id !== liveId} class:focus={s.id === show.focusId}
            data-id={s.id}
            onclick={() => goLive(i)}
            ondblclick={() => { if (s.kind === 'bible') addToHistory(s); }}
            title={s.kind === 'bible' ? 'Click to show. Double-click to keep it in History.' : 'Show on screen'}
          >
            <span class="num mono">{s.num}</span>
            <span class="body">
              {#if s.te}<span class="te-line te">{s.te}</span>{/if}
              {#if s.en}<span class="en-line">{s.en}</span>{/if}
              {#if s.parts > 1 || s.id === liveId || s.id === nextSlide?.id || (s.label && s.part === 1)}
                <span class="tags">
                  {#if s.label && s.part === 1}<span class="chip" class:chip--next={s.repeat}>{s.label}</span>{/if}
                  {#if s.id === liveId}<span class="chip chip--live"><span class="dot"></span>On screen</span>
                  {:else if s.id === nextSlide?.id}<span class="chip chip--next">Next</span>{/if}
                  {#if s.parts > 1}<span class="chip">Part {s.part} of {s.parts}{s.part < s.parts ? ', continues' : ''}</span>{/if}
                </span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="none">
    <div class="empty">
      <b>Nothing open</b>
      Search a reference like <span class="mono">jn 3 16</span>, pick a book, or open a song. Its slides appear here, and a click puts one on screen.
    </div>
  </div>
{/if}

<style>
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 8px 16px; border-bottom: 1px solid var(--rule); flex: none; }
  .title { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  .t { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }
  .sub { color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .tools { display: flex; gap: 6px; align-items: center; flex: none; }
  .field.small { height: 28px; font-size: 12px; width: auto; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .slides { list-style: none; margin: 0; padding: 12px 16px 40px; display: grid; gap: 8px; }
  .slide { width: 100%; display: grid; grid-template-columns: 46px 1fr; gap: 10px; padding: 12px 14px 12px 0; text-align: left; border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); cursor: pointer; transition: border-color var(--fast) var(--ease); }
  .slide:hover { border-color: var(--rule-2); }
  .slide.focus { border-color: var(--rule-2); }
  .slide.live { border-color: var(--live); box-shadow: inset 3px 0 0 var(--live); }
  .slide.next { border-color: var(--next-line); box-shadow: inset 3px 0 0 var(--next); }
  .num { text-align: right; color: var(--muted); font-size: 13px; padding-top: 3px; }
  .live .num { color: var(--live); }
  .next .num { color: var(--next); }
  .body { min-width: 0; }
  .te-line { display: block; font-size: 16px; line-height: 1.6; white-space: pre-line; }
  .en-line { display: block; margin-top: 4px; color: var(--muted); font-size: 13px; line-height: 1.5; white-space: pre-line; }
  .tags { display: flex; gap: 6px; margin-top: 8px; }
  .none { flex: 1; display: grid; place-items: center; }
  .none .empty { max-width: 380px; }
</style>
