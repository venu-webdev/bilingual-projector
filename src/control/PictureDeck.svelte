<script>
  // A picture set as a grid. Click picks a picture (it waits in Next, and the adjust panel opens);
  // double-click, Enter or Space shows it. Drag the big preview to move the picture, scroll on it to
  // zoom, and every adjustment reaches the live screen as it is made.
  import Stage from '../lib/Stage.svelte';
  import { DEFAULT_ADJUST, adjustOf } from '../lib/pictures.js';
  import { lib, show, save, goLive, addToOrder, pictureById, removePicture, movePicture, frameOf } from './state.svelte.js';
  import Icon from './Icon.svelte';

  const slides = $derived(show.deck.slides);
  const focus = $derived(slides.find((s) => s.id === show.focusId) || slides[0]);
  const img = $derived(focus ? pictureById(focus.imageId) : null);
  const a = $derived(img ? adjustOf(img.adjust) : DEFAULT_ADJUST);
  const liveId = $derived(show.live?.slide.id);
  const isLive = $derived(focus && focus.id === liveId);

  // Keep the stored adjust complete, then save after each change.
  const set = (patch) => { if (!img) return; img.adjust = { ...adjustOf(img.adjust), ...patch }; save('images'); };
  const reset = (keys) => set(Object.fromEntries(keys.map((k) => [k, DEFAULT_ADJUST[k]])));

  // Drag to move, wheel to zoom, on the preview.
  let box = $state(null);
  let drag = null;
  function down(e) {
    if (!img || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, ox: a.x, oy: a.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drag || !box) return;
    const r = box.getBoundingClientRect();
    const clamp = (v) => Math.max(-50, Math.min(50, Math.round(v * 10) / 10));
    set({ x: clamp(drag.ox + ((e.clientX - drag.x) / r.width) * 100), y: clamp(drag.oy + ((e.clientY - drag.y) / r.height) * 100) });
  }
  const up = () => (drag = null);
  function wheel(e) {
    if (!img) return;
    e.preventDefault();
    set({ zoom: Math.max(0.3, Math.min(4, Math.round((a.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)) * 100) / 100)) });
  }

  let dragFrom = $state(-1);
  let over = $state(-1);
  const pick = (s) => (show.focusId = s.id);
  const showIt = (i) => goLive(i);

  const sliders = [
    ['brightness', 'Brightness', 20, 200, 1, '%'],
    ['contrast', 'Contrast', 20, 200, 1, '%'],
    ['saturate', 'Colour', 0, 250, 1, '%'],
    ['hue', 'Hue', -180, 180, 1, '°'],
    ['blur', 'Blur', 0, 30, 0.5, 'px'],
    ['grayscale', 'Black and white', 0, 100, 1, '%'],
  ];
</script>

<div class="head">
  <div class="title"><span class="t">{show.deck.title}</span><span class="meta mono">{slides.length} pictures</span></div>
  <div class="tools">
    <button class="btn btn--sm" onclick={addToOrder}><Icon name="plus" />Add to order</button>
    {#if focus}<button class="btn btn--sm btn--live" onclick={() => showIt(slides.indexOf(focus))} disabled={isLive}>{isLive ? 'On screen' : 'Show'} <kbd class="on-live">Space</kbd></button>{/if}
  </div>
</div>

{#if !slides.length}
  <div class="none"><div class="empty"><b>No pictures in this set yet</b>Copy a picture and press Ctrl V, drag picture files here, choose Add files in the Pictures tab, or find pictures for the verse there.</div></div>
{:else}
  <div class="body">
    <ol class="grid">
      {#each slides as s, i (s.id)}
        <li class:over={over === i} draggable="true"
          ondragstart={() => (dragFrom = i)} ondragover={(e) => { e.preventDefault(); over = i; }} ondragleave={() => { if (over === i) over = -1; }}
          ondrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragFrom >= 0 && dragFrom !== i) movePicture(dragFrom, i); dragFrom = over = -1; }} ondragend={() => (dragFrom = over = -1)}>
          <button class="cell" class:live={s.id === liveId} class:focus={s.id === focus?.id} onclick={() => pick(s)} ondblclick={() => showIt(i)} title={`${s.label}\nClick to pick, double-click to show`}>
            <span class="thumb"><Stage frame={frameOf(s)} animate={false} /></span>
            <span class="cap"><span class="n mono">{s.num}</span><span class="nm">{s.label}</span></span>
            {#if s.id === liveId}<span class="chip chip--live tag"><span class="dot"></span>On screen</span>{:else if s.id === focus?.id}<span class="chip chip--next tag">Next</span>{/if}
          </button>
          <button class="x" aria-label={`Remove ${s.label} from this set`} onclick={() => removePicture(s.imageId)}><Icon name="close" /></button>
        </li>
      {/each}
    </ol>

    {#if img}
      <aside class="adj" aria-label="Adjust the picture">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="preview" class:live={isLive} bind:this={box} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel} title="Drag to move, scroll to zoom">
          <Stage frame={frameOf(focus)} animate={false} />
          <span class="hint">{isLive ? 'On screen now: changes show at once' : 'Drag to move · scroll to zoom'}</span>
        </div>
        {#if img.credit}<p class="credit">{img.credit}</p>{/if}

        <div class="grp">
          <div class="row"><span>Fit</span>
            <span class="seg">
              {#each [['cover', 'Fill screen'], ['contain', 'Whole picture'], ['fill', 'Stretch'], ['none', 'Actual size']] as [v, l]}
                <button aria-pressed={a.fit === v} onclick={() => set({ fit: v })}>{l}</button>
              {/each}
            </span>
          </div>
          {#if a.fit === 'contain'}
            <div class="row"><span>Around it</span><span class="seg"><button aria-pressed={a.backdrop !== 'black'} onclick={() => set({ backdrop: 'blur' })}>Soft blur</button><button aria-pressed={a.backdrop === 'black'} onclick={() => set({ backdrop: 'black' })}>Black</button></span></div>
          {/if}
          <div class="row"><span>Zoom</span><input type="range" min="0.3" max="4" step="0.01" value={a.zoom} oninput={(e) => set({ zoom: +e.currentTarget.value })} /><span class="v mono">{Math.round(a.zoom * 100)}%</span></div>
          <div class="row"><span>Left / right</span><input type="range" min="-50" max="50" step="0.5" value={a.x} oninput={(e) => set({ x: +e.currentTarget.value })} /><span class="v mono">{a.x}</span></div>
          <div class="row"><span>Up / down</span><input type="range" min="-50" max="50" step="0.5" value={a.y} oninput={(e) => set({ y: +e.currentTarget.value })} /><span class="v mono">{a.y}</span></div>
          <div class="row"><span>Rotate</span><input type="range" min="-180" max="180" step="1" value={a.rotate} oninput={(e) => set({ rotate: +e.currentTarget.value })} /><span class="v mono">{a.rotate}°</span></div>
          <div class="btns">
            <button class="btn btn--sm" onclick={() => set({ rotate: ((a.rotate - 90 + 540) % 360) - 180 })}>↺ 90°</button>
            <button class="btn btn--sm" onclick={() => set({ rotate: ((a.rotate + 90 + 540) % 360) - 180 })}>↻ 90°</button>
            <button class="btn btn--sm" aria-pressed={a.flipX} onclick={() => set({ flipX: !a.flipX })}>Flip ↔</button>
            <button class="btn btn--sm" aria-pressed={a.flipY} onclick={() => set({ flipY: !a.flipY })}>Flip ↕</button>
            <button class="btn btn--sm btn--quiet" onclick={() => reset(['zoom', 'x', 'y', 'rotate', 'flipX', 'flipY'])}>Centre</button>
          </div>
        </div>

        <div class="grp">
          {#each sliders as [k, label, min, max, step, unit]}
            <div class="row"><span>{label}</span><input type="range" {min} {max} {step} value={a[k]} oninput={(e) => set({ [k]: +e.currentTarget.value })} ondblclick={() => reset([k])} /><span class="v mono">{a[k]}{unit}</span></div>
          {/each}
          <div class="row"><span>Darken</span><input type="range" min="0" max="0.85" step="0.05" value={a.dim} oninput={(e) => set({ dim: +e.currentTarget.value })} /><span class="v mono">{Math.round(a.dim * 100)}%</span></div>
          <div class="btns">
            <button class="btn btn--sm btn--quiet" onclick={() => reset(['brightness', 'contrast', 'saturate', 'hue', 'blur', 'grayscale', 'dim'])}>Reset colours</button>
            <button class="btn btn--sm btn--quiet" onclick={() => set({ ...DEFAULT_ADJUST })}>Reset everything</button>
          </div>
          <p class="note">Double-click a slider to reset just that one.</p>
        </div>
      </aside>
    {/if}
  </div>
{/if}

<style>
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 8px 16px; border-bottom: 1px solid var(--rule); flex: none; }
  .title { display: flex; align-items: baseline; gap: 10px; }
  .t { font-size: 17px; font-weight: 600; }
  .meta { color: var(--muted); font-size: 12px; }
  .tools { display: flex; gap: 6px; }
  .on-live { background: transparent; border-color: oklch(40% 0.08 75); color: var(--live-ink); }
  .none { flex: 1; display: grid; place-items: center; }
  .none .empty { max-width: 420px; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(300px, 44%); }
  .grid { list-style: none; margin: 0; padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; align-content: start; overflow-y: auto; }
  li { position: relative; border-left: 3px solid transparent; }
  li.over { border-left-color: var(--next); }
  .cell { display: flex; flex-direction: column; width: 100%; padding: 0 0 6px; border: 1px solid var(--rule); border-radius: 8px; background: var(--paper-2); cursor: pointer; overflow: hidden; text-align: left; }
  .cell.focus { border-color: var(--next); box-shadow: inset 0 0 0 1px var(--next); }
  .cell.live { border-color: var(--live); box-shadow: inset 0 0 0 1px var(--live); }
  .thumb { display: block; width: 100%; aspect-ratio: 16 / 9; pointer-events: none; }
  .cap { display: flex; gap: 6px; padding: 5px 8px 0; font-size: 12px; min-width: 0; }
  .n { color: var(--muted); }
  .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag { margin: 5px 8px 0; align-self: flex-start; }
  .x { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: 0; border-radius: 4px; background: rgb(0 0 0 / 0.65); color: #fff; display: grid; place-items: center; cursor: pointer; opacity: 0; }
  .x :global(svg) { width: 12px; height: 12px; }
  li:hover .x, .x:focus-visible { opacity: 1; }
  .adj { border-left: 1px solid var(--rule); overflow-y: auto; padding: 12px 14px 20px; display: flex; flex-direction: column; gap: 10px; }
  .preview { position: relative; aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden; outline: 1px solid var(--next-line); outline-offset: 2px; cursor: grab; touch-action: none; flex: none; }
  .preview:active { cursor: grabbing; }
  .preview.live { outline: 2px solid var(--live); }
  .preview .hint { position: absolute; left: 6px; bottom: 6px; padding: 2px 7px; border-radius: 4px; background: rgb(0 0 0 / 0.7); color: #e6e9ee; font-size: 11px; pointer-events: none; }
  .credit { margin: -4px 0 0; color: var(--muted); font-size: 11px; }
  .grp { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); padding: 8px 10px; display: grid; gap: 4px; }
  .row { display: flex; align-items: center; gap: 8px; min-height: 30px; font-size: 13px; flex-wrap: wrap; }
  .row > span:first-child { width: 96px; color: var(--ink-2); flex: none; }
  .row input[type="range"] { flex: 1; min-width: 80px; accent-color: var(--next); }
  .v { width: 46px; text-align: right; color: var(--muted); font-size: 12px; }
  .btns { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px; }
  .btns .btn[aria-pressed="true"] { background: var(--next-soft); border-color: var(--next-line); color: var(--next); }
  .note { margin: 0; color: var(--muted); font-size: 11px; }
</style>
