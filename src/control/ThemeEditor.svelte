<script>
  import { lib, show, lookEdited, useLook, save } from './state.svelte.js';
  import { TELUGU_FONTS, ENGLISH_FONTS } from '../lib/fonts.js';
  import { PRESETS, SAMPLE } from '../lib/presets.js';
  import { MOTIONS } from '../lib/motion.js';
  import Stage from '../lib/Stage.svelte';
  import Icon from './Icon.svelte';

  let kind = $state(show.live?.slide.kind === 'song' ? 'song' : 'bible');
  const t = $derived(lib.settings.themes[kind]);
  const s = () => lookEdited(kind);
  let fine = $state(false); // the detailed controls are folded away until asked for
  let demo = $state(0);     // bumping it replays the animation previews

  async function pickMedia(type) {
    const url = await window.projector.pickMedia(type);
    if (!url) return;
    t.background.type = type;
    t.background.media = url;
    s();
  }
</script>

<div class="te-ed">
  <div class="seg kind">
    <button aria-pressed={kind === 'bible'} onclick={() => (kind = 'bible')}>Bible slides</button>
    <button aria-pressed={kind === 'song'} onclick={() => (kind = 'song')}>Song slides</button>
  </div>

  <label class="link">
    <input type="checkbox" bind:checked={lib.settings.linkLooks} onchange={() => save('settings')} />
    <span><b>Same look for songs and Bible</b><small>Background, fonts and colours stay matched. Sizes, languages and the reference stay separate.</small></span>
  </label>

  <div class="gallery" role="list">
    {#each PRESETS as p (p.id)}
      <button class="look" class:on={lib.settings.look === p.id} role="listitem" onclick={() => useLook(p, kind)} title={p.use}>
        <span class="thumb"><Stage frame={{ slide: SAMPLE[kind], theme: p[kind] }} animate={false} /></span>
        <span class="look__n">{p.name}</span>
        <span class="look__u">{p.use}</span>
      </button>
    {/each}
  </div>

  <button class="btn btn--sm fine-toggle" aria-expanded={fine} onclick={() => (fine = !fine)}>{fine ? 'Hide' : 'Adjust'} the {kind === 'song' ? 'song' : 'Bible'} look in detail</button>

  {#if fine}
  <section>
    <h3>Background</h3>
    <div class="seg">
      {#each [['solid', 'Colour'], ['gradient', 'Gradient'], ['image', 'Picture'], ['video', 'Video']] as [v, l]}
        <button aria-pressed={t.background.type === v} onclick={() => { t.background.type = v; s(); }}>{l}</button>
      {/each}
    </div>
    {#if t.background.type === 'solid'}
      <div class="row"><span>Colour</span><input type="color" bind:value={t.background.color} onchange={s} /></div>
    {:else if t.background.type === 'gradient'}
      <div class="row"><span>From</span><input type="color" bind:value={t.background.from} onchange={s} /></div>
      <div class="row"><span>To</span><input type="color" bind:value={t.background.to} onchange={s} /></div>
      <div class="row"><span>Angle</span><input type="range" min="0" max="360" step="15" bind:value={t.background.angle} onchange={s} /><span class="mono v">{t.background.angle}°</span></div>
    {:else}
      <div class="row">
        <button class="btn btn--sm" onclick={() => pickMedia(t.background.type)}><Icon name={t.background.type === 'video' ? 'video' : 'image'} />{t.background.media ? 'Change' : 'Choose'} {t.background.type === 'video' ? 'video' : 'picture'}…</button>
        {#if t.background.media}<button class="btn btn--sm btn--quiet" onclick={() => { t.background.media = ''; s(); }}>Remove</button>{/if}
      </div>
      <div class="row"><span>Darken</span><input type="range" min="0" max="0.85" step="0.05" bind:value={t.background.dim} onchange={s} /><span class="mono v">{Math.round(t.background.dim * 100)}%</span></div>
    {/if}
  </section>

  <section>
    <h3>How the words arrive</h3>
    <div class="motions">
      {#each MOTIONS as [v, l]}
        <button class="motion" class:on={(t.motion || 'fade') === v} onclick={() => { t.motion = v; s(); demo++; }}>
          <!-- the stage stays mounted and only the slide id changes, so the entrance plays as it would live -->
          <span class="m-thumb"><Stage frame={{ slide: { ...SAMPLE[kind], id: `demo-${demo}-${v}` }, theme: { ...t, motion: v } }} /></span>
          <span>{l}</span>
        </button>
      {/each}
    </div>
    <div class="row"><span>Speed</span><span class="seg">
      {#each [['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']] as [v, l]}
        <button aria-pressed={(t.motionSpeed || 'normal') === v} onclick={() => { t.motionSpeed = v; s(); demo++; }}>{l}</button>
      {/each}
    </span><button class="btn btn--sm btn--quiet" onclick={() => demo++}>Play again</button></div>
    <p class="hint">Cascade brings in the Telugu, then the English, then the reference. Choose None for the quickest changes during fast songs.</p>
  </section>

  <section>
    <h3>Where the words sit</h3>
    <div class="row"><span>Place</span><span class="seg"><button aria-pressed={t.position !== 'lower'} onclick={() => { t.position = 'center'; s(); }}>Middle</button><button aria-pressed={t.position === 'lower'} onclick={() => { t.position = 'lower'; s(); }}>Lower third</button></span></div>
    {#if t.position === 'lower'}
      <div class="row"><span>Band</span><input type="color" bind:value={t.band.color} onchange={s} /><input type="range" min="0" max="0.95" step="0.05" bind:value={t.band.opacity} onchange={s} /><span class="mono v">{Math.round(t.band.opacity * 100)}%</span></div>
      <p class="hint">For livestreams: the words sit in a band at the bottom so the camera or video stays visible above them.</p>
    {/if}
    <div class="row"><span>Align</span><span class="seg"><button aria-pressed={t.align !== 'left'} onclick={() => { t.align = 'center'; s(); }}>Centre</button><button aria-pressed={t.align === 'left'} onclick={() => { t.align = 'left'; s(); }}>Left</button></span></div>
  </section>

  <section>
    <h3>Telugu text</h3>
    <div class="row"><span>Font</span><select class="field sm" bind:value={t.teFont} onchange={s}>{#each TELUGU_FONTS as f}<option>{f}</option>{/each}</select></div>
    <div class="row"><span>Largest size</span><input type="range" min="36" max="140" step="2" bind:value={t.teSize} onchange={s} /><span class="mono v">{t.teSize}</span></div>
    <div class="row"><span>Colour</span><input type="color" bind:value={t.teColor} onchange={s} /></div>
  </section>

  <section>
    <h3>English text</h3>
    <div class="row"><span>Font</span><select class="field sm" bind:value={t.enFont} onchange={s}>{#each ENGLISH_FONTS as f}<option>{f}</option>{/each}</select></div>
    <div class="row"><span>Largest size</span><input type="range" min="24" max="120" step="2" bind:value={t.enSize} onchange={s} /><span class="mono v">{t.enSize}</span></div>
    <div class="row"><span>Colour</span><input type="color" bind:value={t.enColor} onchange={s} /></div>
  </section>

  <section>
    <h3>Type</h3>
    <div class="row"><span>Weight</span><span class="seg"><button aria-pressed={t.weight < 500} onclick={() => { t.weight = 400; s(); }}>Regular</button><button aria-pressed={t.weight >= 500} onclick={() => { t.weight = 600; s(); }}>Bold</button></span></div>
    <div class="row"><span>Line spacing</span><input type="range" min="1.1" max="2" step="0.05" bind:value={t.lineHeight} onchange={s} /><span class="mono v">{Number(t.lineHeight).toFixed(2)}</span></div>
    <div class="row"><span>Shadow</span><span class="seg"><button aria-pressed={t.shadow} onclick={() => { t.shadow = true; s(); }}>On</button><button aria-pressed={!t.shadow} onclick={() => { t.shadow = false; s(); }}>Off</button></span></div>
  </section>

  <section>
    <h3>Reference</h3>
    <div class="row"><span>Show</span><span class="seg"><button aria-pressed={t.reference.show} onclick={() => { t.reference.show = true; s(); }}>{kind === 'song' ? 'Song title' : 'Yes'}</button><button aria-pressed={!t.reference.show} onclick={() => { t.reference.show = false; s(); }}>No</button></span></div>
    <div class="row"><span>Place</span><span class="seg"><button aria-pressed={t.reference.position === 'top'} onclick={() => { t.reference.position = 'top'; s(); }}>Above</button><button aria-pressed={t.reference.position !== 'top'} onclick={() => { t.reference.position = 'bottom'; s(); }}>Below</button></span></div>
    <div class="row"><span>Size</span><input type="range" min="18" max="64" step="2" bind:value={t.reference.size} onchange={s} /><span class="mono v">{t.reference.size}</span></div>
    <div class="row"><span>Colour</span><input type="color" bind:value={t.reference.color} onchange={s} /></div>
  </section>

  <section>
    <h3>Long {kind === 'song' ? 'stanzas' : 'verses'}</h3>
    <div class="row">
      <span>Smallest text</span>
      <input type="range" min="0.6" max="1" step="0.05" bind:value={t.minFit} onchange={s} />
      <span class="mono v">{Math.round(t.minFit * 100)}%</span>
    </div>
    <p class="hint">When a {kind === 'song' ? 'stanza' : 'verse'} would have to shrink below this share of the size above, it continues on a new slide instead. It breaks at a sentence or a comma{kind === 'song' ? ', or between lines' : ''}, and the room sees dots by the reference showing there is more.</p>
    <div class="row">
      <span>Steady size</span>
      <span class="seg"><button aria-pressed={t.steady !== false} onclick={() => { t.steady = true; s(); }}>On</button><button aria-pressed={t.steady === false} onclick={() => { t.steady = false; s(); }}>Off</button></span>
    </div>
    <p class="hint">On: every slide of a passage uses the same text size, so it does not jump from verse to verse. Off: each slide is as large as it can be.</p>
  </section>
  <p class="note">Sizes are the largest the text may be on a 1920 × 1080 screen. Nothing is ever cut off.</p>
  {/if}
</div>

<style>
  .te-ed { padding: 4px 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .kind { align-self: stretch; display: grid; grid-template-columns: 1fr 1fr; }
  .link { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); cursor: pointer; }
  .link input { margin-top: 3px; accent-color: var(--next); width: 16px; height: 16px; }
  .link b { display: block; font-weight: 600; font-size: 13px; }
  .link small { display: block; color: var(--muted); font-size: 12px; line-height: 1.4; }
  .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .look { display: flex; flex-direction: column; gap: 3px; padding: 0 0 8px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); cursor: pointer; text-align: left; overflow: hidden; transition: border-color var(--fast) var(--ease); }
  .look:hover { border-color: var(--rule-2); }
  .look.on { border-color: var(--next); box-shadow: inset 0 0 0 1px var(--next); }
  /* the stage inside has no size of its own (it scales to its box), so the box sets the width */
  .thumb { display: block; width: 100%; aspect-ratio: 16 / 9; pointer-events: none; }
  .look__n { padding: 4px 9px 0; font-weight: 600; font-size: 13px; }
  .look__u { padding: 0 9px; color: var(--muted); font-size: 11px; line-height: 1.35; }
  .fine-toggle { align-self: flex-start; }
  .motions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .motion { display: flex; flex-direction: column; gap: 4px; padding: 0 0 5px; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper-3); cursor: pointer; font-size: 12px; overflow: hidden; }
  .motion.on { border-color: var(--next); color: var(--next); }
  .m-thumb { display: block; width: 100%; aspect-ratio: 16 / 9; pointer-events: none; }
  section { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  h3 { margin: 0; font-size: 13px; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 10px; font-size: 13px; min-height: 30px; }
  .row > span:first-child { color: var(--ink-2); width: 92px; flex: none; }
  .row input[type="range"] { flex: 1; accent-color: var(--next); }
  .row input[type="color"] { width: 44px; height: 28px; padding: 0; border: 1px solid var(--rule-2); border-radius: 4px; background: none; cursor: pointer; }
  .v { color: var(--muted); font-size: 12px; min-width: 34px; text-align: right; }
  .field.sm { height: 30px; flex: 1; }
  .note { margin: 0; color: var(--muted); font-size: 12px; }
  .hint { margin: -2px 0 2px; color: var(--muted); font-size: 12px; line-height: 1.45; }
</style>
