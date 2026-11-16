<script>
  // One slide on a 1920 x 1080 canvas, scaled to whatever box holds it. The output window and both
  // previews use this same component, so what the operator sees is exactly what the room sees.
  // Text shrinks to fit the screen (never grows past the theme's size).
  import { fade } from 'svelte/transition';
  import { enter, leave, SPEEDS } from './motion.js';
  import { adjustOf, pictureStyle } from './pictures.js';

  /** @type {{ frame: { slide?: any, theme?: any, black?: boolean, hidden?: boolean } | null, animate?: boolean }} */
  let { frame, animate = true } = $props();

  const W = 1920, H = 1080, PAD_X = 120, PAD_Y = 90, LOWER_H = 340;
  let boxW = $state(0), boxH = $state(0);
  const scale = $derived(Math.min(boxW / W, boxH / H) || 0);

  const theme = $derived(frame?.theme || {});
  const bg = $derived(theme.background || {});
  const slide = $derived(frame?.slide || null);
  // A picture slide fills the screen with the picture, fitted and adjusted its own way.
  const isPic = $derived(slide?.kind === 'image');
  const adj = $derived(adjustOf(slide?.adjust));
  const pic = $derived(pictureStyle(slide?.adjust));
  const layout = $derived(theme.layout || 'both');
  // A slide with only one language shows it whatever the layout says, so nothing goes blank.
  const showTe = $derived(!!slide?.te && (layout !== 'en' || !slide?.en));
  const showEn = $derived(!!slide?.en && (layout !== 'te' || !slide?.te));
  const lower = $derived(theme.position === 'lower');
  const band = $derived(theme.band || { color: '#000000', opacity: 0.6 });
  const ref = $derived(theme.reference?.show && slide ? (theme.reference.lang === 'en' ? slide.refEn : slide.refTe) : '');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = $derived(animate && !reduce ? SPEEDS[theme.motionSpeed] || SPEEDS.normal : 0);
  const motion = $derived(theme.motion || 'fade');
  // Cascade brings in the parts one after another; every other motion moves the block as one.
  const part = (i) => ({ motion, duration: dur, delay: motion === 'cascade' ? i * Math.round(dur * 0.3) : 0 });

  const background = $derived(isPic ? '#000' :
    bg.type === 'solid' ? bg.color
      : bg.type === 'gradient' ? `linear-gradient(${bg.angle ?? 135}deg, ${bg.from}, ${bg.to})`
      : '#000');

  // Fit: find the largest text scale (up to 1) at which the block fits the safe area.
  let textEl = $state(null);
  let fit = $state(1);
  $effect(() => {
    // re-run when anything that changes the text's size changes
    void [slide?.id, slide?.te, slide?.en, slide?.fit, layout, theme.teSize, theme.enSize, theme.teFont, theme.enFont, theme.lineHeight, theme.weight, ref, theme.reference?.size];
    if (!textEl) return;
    void lower;
    const limitH = lower ? LOWER_H : H - PAD_Y * 2;
    const measure = (f) => { textEl.style.setProperty('--fit', String(f)); return textEl.scrollHeight <= limitH + 1; };
    // A passage set to steady size gives every slide the same scale; it is still checked, never trusted blindly.
    const top = Math.min(1, slide?.fit || 1);
    if (measure(top)) { fit = top; return; }
    let lo = 0.25, hi = top;
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (measure(mid)) lo = mid; else hi = mid; }
    measure(lo);
    fit = lo;
  });
</script>

<div class="box" bind:clientWidth={boxW} bind:clientHeight={boxH}>
  <div class="stage" style:transform={`translate(-50%, -50%) scale(${scale})`} style:background={background}>
    {#if isPic && !frame?.hidden}
      {#key slide.id}
        <div class="pic" in:enter={{ motion: 'fade', duration: dur }} out:leave={{ duration: dur }}>
          {#if adj.fit === 'contain' && adj.backdrop === 'blur'}<img class="pic-bg" src={slide.url} alt="" />{/if}
          <img class="pic-img" src={slide.url} alt="" style:object-fit={pic.fit} style:object-position={pic.position} style:transform-origin={pic.origin} style:transform={pic.transform} style:filter={pic.filter} />
          {#if adj.dim}<div class="dim" style:opacity={adj.dim}></div>{/if}
        </div>
      {/key}
    {:else if !isPic && bg.type === 'image' && bg.media}
      <img class="media" src={bg.media} alt="" />
    {:else if !isPic && bg.type === 'video' && bg.media}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video class="media" src={bg.media} autoplay muted loop playsinline></video>
    {/if}
    {#if !isPic && (bg.type === 'image' || bg.type === 'video') && bg.media}
      <div class="dim" style:opacity={bg.dim ?? 0.35}></div>
    {/if}

    {#if lower && slide && !isPic && !frame?.hidden}
      <!-- lower third: a band across the bottom, solid under the words and fading out above them -->
      <div class="band" style:--band={`color-mix(in srgb, ${band.color} ${Math.round((band.opacity ?? 0.6) * 100)}%, transparent)`} transition:fade={{ duration: dur }}></div>
    {/if}
    {#if slide && !isPic && !frame?.hidden}
      {#key slide.id}
        <div
          class="text"
          class:lower
          class:side={layout === 'side' && showTe && showEn}
          class:left={theme.align === 'left'}
          class:shadow={theme.shadow !== false}
          bind:this={textEl}
          style:--fit={fit}
          style:--te-size={`${theme.teSize || 72}px`}
          style:--en-size={`${theme.enSize || 48}px`}
          style:--lh={theme.lineHeight || 1.4}
          in:enter={motion === 'cascade' ? { motion: 'none' } : part(0)}
          out:leave={{ duration: dur }}
        >
          {#snippet refLine()}
            <div class="ref" style:color={theme.reference.color} style:font-size={`${theme.reference.size}px`} in:enter|global={motion === 'cascade' ? part(theme.reference.position === 'top' ? 0 : 2) : { motion: 'none' }}>
              {ref}{#if slide.parts > 1}<span class="dots" aria-label={`part ${slide.part} of ${slide.parts}`}>{#each Array(slide.parts) as _, i}<i class:on={i < slide.part}></i>{/each}</span>{/if}
            </div>
          {/snippet}
          {#if ref && theme.reference.position === 'top'}{@render refLine()}{/if}
          {#if showTe}
            <div class="te" in:enter|global={motion === 'cascade' ? part(theme.reference.position === 'top' && ref ? 1 : 0) : { motion: 'none' }} style:font-family={`"${theme.teFont}", "Nirmala UI", sans-serif`} style:color={theme.teColor} style:font-weight={theme.weight}>{slide.te}</div>
          {/if}
          {#if showEn}
            <div class="en" in:enter|global={motion === 'cascade' ? part(theme.reference.position === 'top' && ref ? 2 : 1) : { motion: 'none' }} style:font-family={`"${theme.enFont}", "Segoe UI", sans-serif`} style:color={theme.enColor} style:font-weight={Math.min(theme.weight || 600, 600)}>{slide.en}</div>
          {/if}
          {#if ref && theme.reference.position !== 'top'}{@render refLine()}{/if}
          {#if !ref && slide.parts > 1}
            <!-- no reference shown: the dots still tell the room the verse goes on -->
            <div class="ref"><span class="dots" style:color={theme.reference?.color || '#ffd36b'}>{#each Array(slide.parts) as _, i}<i class:on={i < slide.part}></i>{/each}</span></div>
          {/if}
        </div>
      {/key}
    {/if}

    {#if frame?.black}
      <div class="black" transition:fade={{ duration: dur }}></div>
    {/if}
  </div>
</div>

<style>
  .box { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; container-type: size; }
  .stage { position: absolute; left: 50%; top: 50%; width: 1920px; height: 1080px; transform-origin: center; overflow: hidden; }
  .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .dim { position: absolute; inset: 0; background: #000; }
  .pic { position: absolute; inset: 0; overflow: hidden; }
  .pic-img { position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: center; }
  .pic-bg { position: absolute; inset: -60px; width: calc(100% + 120px); height: calc(100% + 120px); object-fit: cover; filter: blur(40px) brightness(0.55) saturate(1.1); }
  .black { position: absolute; inset: 0; background: #000; z-index: 5; }
  .text {
    /* "safe" keeps overflowing text aligned to the top, so scrollHeight measures all of it while fitting */
    position: absolute; inset: 90px 120px; display: flex; flex-direction: column; justify-content: safe center; align-items: center;
    gap: calc(28px * var(--fit)); text-align: center; white-space: pre-line; overflow: hidden;
  }
  .text.left { align-items: flex-start; text-align: left; }
  .text.lower { inset: auto 100px 64px 100px; height: 340px; }
  .band { position: absolute; left: 0; right: 0; bottom: 0; height: 500px; background: linear-gradient(to top, var(--band) 72%, transparent); }
  .text.side { display: grid; grid-template-columns: 1fr 1fr; align-items: center; align-content: safe center; column-gap: 80px; }
  .text.side .ref { grid-column: 1 / -1; }
  .text.shadow { text-shadow: 0 3px 14px rgba(0, 0, 0, 0.7); }
  .te { font-size: calc(var(--te-size) * var(--fit)); line-height: calc(var(--lh) + 0.1); }
  .en { font-size: calc(var(--en-size) * var(--fit)); line-height: var(--lh); }
  .ref { font-family: "Hind Guntur", "Inter", sans-serif; font-weight: 500; opacity: 0.95; display: inline-flex; align-items: center; gap: 0.6em; }
  .dots { display: inline-flex; gap: 0.32em; }
  .dots i { width: 0.36em; height: 0.36em; border-radius: 50%; border: 0.07em solid currentColor; opacity: 0.8; }
  .dots i.on { background: currentColor; opacity: 1; }
</style>
