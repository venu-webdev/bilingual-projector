<script>
  // The livestream overlay: drawn on a transparent 1920 x 1080 canvas for an OBS Browser Source.
  // It follows the live slide but shows only what the stream needs: a reference card in the corner,
  // the words in a lower third, the song title, the full slide, or nothing. Its look is its own,
  // because a camera picture needs something quieter than a projector screen.
  import Stage from './Stage.svelte';
  import { enter, leave, SPEEDS } from './motion.js';

  /** @type {{ frame: any, preview?: boolean }} */
  let { frame, preview = false } = $props();

  const W = 1920, H = 1080;
  let boxW = $state(0), boxH = $state(0);
  const scale = $derived(Math.min(boxW / W, boxH / H) || 0);

  const st = $derived(frame?.stream || {});
  const slide = $derived(frame?.slide || null);
  const kind = $derived(slide?.kind || 'bible');
  const mode = $derived(!slide ? 'off' : kind === 'image' ? (st.image === 'off' ? 'off' : 'full') : kind === 'song' ? st.song || 'lower' : st.bible || 'reference');
  const side = $derived(st.corner === 'right' ? 'right' : 'left');
  const accent = $derived(st.accent || '#ffd36b');
  const dur = $derived(SPEEDS[st.speed] || SPEEDS.normal);

  // Auto-hide: the card shows when the slide changes, then steps aside after N seconds.
  let expired = $state(false);
  let timer;
  $effect(() => {
    void slide?.id; void st.autoHide; void frame?.visible;
    expired = false;
    clearTimeout(timer);
    if (st.autoHide > 0 && mode !== 'full') timer = setTimeout(() => (expired = true), st.autoHide * 1000);
    return () => clearTimeout(timer);
  });
  const visible = $derived(!!slide && mode !== 'off' && frame?.visible !== false && !frame?.black && !frame?.hidden && !expired);

  // The lower third fits its words into the band the same way the stage does.
  let wordsEl = $state(null);
  let fit = $state(1);
  $effect(() => {
    void [slide?.id, slide?.te, slide?.en, mode, lang, visible];
    if (!wordsEl) return;
    const ok = (f) => { wordsEl.style.setProperty('--f', String(f)); return wordsEl.scrollHeight <= wordsEl.clientHeight + 1; };
    if (ok(1)) { fit = 1; return; }
    let lo = 0.35, hi = 1;
    for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    ok(lo); fit = lo;
  });

  const refTe = $derived(slide?.refTe || '');
  const refEn = $derived(slide?.refEn || '');
  const partNote = $derived(slide?.parts > 1 ? `${slide.part}/${slide.parts}` : '');
  // The stream's languages: 'same' follows what the projector shows for this slide (Telugu only,
  // English only, both); otherwise the operator's own choice for the stream.
  const lang = $derived(st.lang && st.lang !== 'same' ? st.lang : ((l) => (l === 'te' ? 'te' : l === 'en' ? 'en' : 'both'))(frame?.theme?.layout));
  const showTe = $derived(!!slide?.te && (lang !== 'en' || !slide?.en));
  const showEn = $derived(!!slide?.en && (lang !== 'te' || !slide?.te));
  // the reference, in the same language(s) as the words
  const refMain = $derived(lang === 'en' ? refEn : refTe || refEn);
  const refSecond = $derived(lang === 'both' && refEn !== refMain ? refEn : '');
</script>

<div class="box" class:preview bind:clientWidth={boxW} bind:clientHeight={boxH}>
  {#if preview}<div class="camera" aria-hidden="true"><span>camera</span></div>{/if}
  <div class="canvas" style:transform={`translate(-50%, -50%) scale(${scale})`} style:--accent={accent}>
    {#if visible && mode === 'full'}
      <div class="full" in:enter={{ motion: 'fade', duration: dur }} out:leave={{ duration: dur }}><Stage frame={{ slide, theme: frame.theme }} /></div>
    {:else if visible && (mode === 'reference' || mode === 'title')}
      {#key slide.id + mode}
        <div class="card {side}" in:enter={{ motion: 'left', duration: dur, distance: side === 'right' ? -40 : 40 }} out:leave={{ duration: dur }}>
          <span class="bar"></span>
          <span class="card__body">
            {#if mode === 'title'}
              <span class="kicker">Now singing</span>
              <span class="big te">{slide.refTe}</span>
            {:else}
              <span class="big te">{refMain}{#if partNote}<span class="part">{partNote}</span>{/if}</span>
              {#if refSecond}<span class="small">{refSecond}</span>{/if}
            {/if}
          </span>
        </div>
      {/key}
    {:else if visible && mode === 'lower'}
      <div class="band" in:enter={{ motion: 'rise', duration: dur, distance: 60 }} out:leave={{ duration: dur }}>
        {#key slide.id}
          <div class="lower" class:song={kind === 'song'} bind:this={wordsEl} style:--f={fit} in:enter={{ motion: 'fade', duration: dur }}>
            {#if kind !== 'song'}<span class="tag">{refMain}{#if refSecond}<span>{refSecond}</span>{/if}{#if partNote}<span>{partNote}</span>{/if}</span>{/if}
            {#if showTe}<p class="l-te">{slide.te}</p>{/if}
            {#if showEn}<p class="l-en">{slide.en}</p>{/if}
          </div>
        {/key}
      </div>
    {/if}
  </div>
</div>

<style>
  .box { position: relative; width: 100%; height: 100%; overflow: hidden; container-type: size; background: transparent; }
  .camera { position: absolute; inset: 0; background: radial-gradient(60% 70% at 50% 40%, #5b5148, #2b2621 70%, #1a1714); }
  .camera span { position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%); color: rgb(255 255 255 / 0.28); font: 600 13px "Segoe UI", sans-serif; letter-spacing: 0.04em; }
  .canvas { position: absolute; left: 50%; top: 50%; width: 1920px; height: 1080px; transform-origin: center; }
  .full { position: absolute; inset: 0; }

  .card { position: absolute; bottom: 88px; display: flex; align-items: stretch; max-width: 900px; border-radius: 16px; overflow: hidden; background: rgb(10 12 16 / 0.84); box-shadow: 0 12px 40px rgb(0 0 0 / 0.35); }
  .card.left { left: 88px; }
  .card.right { right: 88px; }
  .bar { width: 10px; background: var(--accent); flex: none; }
  .card__body { display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 22px 34px 22px 28px; }
  .kicker { font: 600 24px "Inter", "Segoe UI", sans-serif; color: var(--accent); }
  .big { font: 700 54px/1.2 "Hind Guntur", "Inter", sans-serif; color: #fff; display: inline-flex; align-items: baseline; gap: 18px; }
  .small { font: 600 32px "Inter", "Segoe UI", sans-serif; color: #c9d1dc; }
  .part { font: 600 28px "Inter", sans-serif; color: var(--accent); }

  .band { position: absolute; left: 0; right: 0; bottom: 0; height: 400px; padding: 70px 110px 54px; background: linear-gradient(to top, rgb(6 8 12 / 0.9) 70%, rgb(6 8 12 / 0)); }
  .lower { height: 100%; display: flex; flex-direction: column; justify-content: safe flex-end; gap: calc(10px * var(--f)); overflow: hidden; text-shadow: 0 2px 10px rgb(0 0 0 / 0.6); }
  .lower.song { justify-content: safe center; align-items: center; text-align: center; }
  .tag { display: inline-flex; gap: 18px; align-items: baseline; font: 700 34px "Hind Guntur", "Inter", sans-serif; color: var(--accent); }
  .tag span { font: 600 26px "Inter", sans-serif; color: #c9d1dc; }
  p { margin: 0; white-space: pre-line; }
  .l-te { font: 600 calc(52px * var(--f)) / 1.45 "Hind Guntur", "Nirmala UI", sans-serif; color: #fff; }
  .l-en { font: 500 calc(36px * var(--f)) / 1.35 "Inter", "Segoe UI", sans-serif; color: #dfe5ee; }
</style>
