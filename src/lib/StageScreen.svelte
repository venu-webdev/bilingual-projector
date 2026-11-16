<script>
  // The stage screen: what the pastor or worship leader sees on a monitor at the front.
  // Built to be read at a glance from a few metres away: the words being shown, where the reading
  // is going next, the time, and a line from the operator. It never shows the room's background.
  // Used by the stage window and by the operator's preview of it, so the two always match:
  // every size is in container units (cqh / cqw) of its own box, not of the window.
  import Stage from './Stage.svelte';

  /** @type {{ frame: any }} */
  let { frame: f } = $props();
  let now = $state(Date.now());
  $effect(() => { const t = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(t); });

  const live = $derived(f?.live || null);
  // follow the projector: Telugu only shows Telugu, English only shows English; 'English on stage' can hide it when both are up
  const lay = $derived(f?.layout || 'both');
  const showTe = $derived(!!live?.te && (lay !== 'en' || !live?.en));
  const showEn = $derived(!!live?.en && (lay === 'en' || !live?.te || (lay !== 'te' && f?.showEnglish !== false)));
  const refMain = $derived(lay === 'en' ? live?.refEn : live?.refTe || live?.refEn);
  const refOther = $derived(lay === 'both' || lay === 'side' ? (lay === 'en' ? '' : live?.refEn) : '');
  const nxt = $derived(f?.next || null);
  const size = $derived(f?.textSize || 1); // the operator's stage text size, 0.6 to 1.6
  const clock = $derived(new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  const elapsed = $derived.by(() => {
    if (!f?.startedAt) return '';
    const s = Math.max(0, Math.floor((now - f.startedAt) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  });
  const firstLine = (s) => (s?.kind === 'image' ? `Picture: ${s.label}` : '') || (s?.te || s?.en || '').split(/\n|(?<=[.;:!?])\s/u)[0];

  // Fit the current words into their area: as large as the chosen size, smaller only if it would not fit.
  let body = $state(null);
  let fit = $state(1);
  $effect(() => {
    void [live?.id, live?.te, live?.en, f?.showEnglish, lay, size];
    if (!body) return;
    const ok = (k) => { body.style.setProperty('--k', String(k)); return body.scrollHeight <= body.clientHeight + 1; };
    if (ok(1)) { fit = 1; return; }
    let lo = 0.2, hi = 1;
    for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    ok(lo); fit = lo;
  });
</script>

<div class="wrap">
  {#if f?.view === 'screen'}
    <!-- the operator chose 'Same as projector': the full slide, exactly as the room sees it -->
    <div class="mirror"><Stage frame={f.screen} /></div>
  {:else}
  <div class="stage" style:--s={size}>
    <header>
      <div class="where">
        {#if live}
          <span class="ref"><span class:te-ref={lay !== 'en'}>{refMain}</span>{#if refOther && refOther !== refMain}<span class="ref-te">{refOther}</span>{/if}</span>
          {#if live.parts > 1}<span class="part" class:more={live.part < live.parts}>Part {live.part} of {live.parts}{live.part < live.parts ? ', continues' : ', end of verse'}</span>{/if}
        {:else}
          <span class="ref dim">Nothing on screen</span>
        {/if}
        {#if f?.black}<span class="state bad">Screen is black</span>{:else if f?.hidden}<span class="state">Text hidden</span>{/if}
      </div>
      <div class="time">
        <span class="clock">{clock}</span>
        {#if elapsed}<span class="elapsed">{elapsed}</span>{/if}
      </div>
    </header>

    {#if f?.message}
      <div class="message" role="status">{f.message}</div>
    {/if}

    <main bind:this={body} style:--k={fit}>
      {#if live?.kind === 'image'}
        <img class="pic" src={live.url} alt={live.label} />
      {:else if live}
        {#if showTe}<p class="te">{live.te}</p>{/if}
        {#if showEn}<p class="en" class:main={!showTe}>{live.en}</p>{/if}
      {/if}
    </main>

    <footer>
      <span class="label">Next</span>
      {#if nxt}
        <span class="n-ref">{nxt.refEn}{nxt.parts > 1 ? ` (${nxt.part}/${nxt.parts})` : ''}</span>
        <span class="n-text">{firstLine(nxt)}</span>
      {:else}
        <span class="n-text dim">End of {f?.deckTitle || 'the list'}</span>
      {/if}
    </footer>
  </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; container-type: size; background: #000; color: #fff; overflow: hidden; }
  .mirror { position: absolute; inset: 0; background: #000; }
  .stage { position: absolute; inset: 0; display: grid; grid-template-rows: auto auto 1fr auto; font-family: "Segoe UI", "Inter", sans-serif; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 3cqw; padding: 2.2cqh 3cqw; border-bottom: 1px solid #2a2f37; }
  .where { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 2cqw; min-width: 0; }
  .ref { font-size: 4.4cqh; font-weight: 700; color: #ffd36b; display: inline-flex; gap: 1.4cqw; align-items: baseline; }
  .ref-te { font-family: "Hind Guntur", sans-serif; font-weight: 600; font-size: 3.6cqh; color: #e9d29a; }
  .part { font-size: 2.8cqh; color: #9aa3ad; }
  .part.more { color: #7cc4ff; }
  .state { font-size: 2.6cqh; font-weight: 700; padding: 0.4cqh 1cqw; border-radius: 6px; background: #2a2f37; color: #fff; }
  .state.bad { background: #b3261e; }
  .time { display: flex; align-items: baseline; gap: 1.6cqw; font-variant-numeric: tabular-nums; flex: none; }
  .clock { font-size: 6cqh; font-weight: 700; }
  .elapsed { font-size: 3.2cqh; color: #9aa3ad; }
  .message { margin: 1.6cqh 3cqw 0; padding: 1.6cqh 2cqw; border-radius: 10px; background: #ffd36b; color: #1a1406; font-size: 5cqh; font-weight: 800; text-align: center; }
  main { min-height: 0; overflow: hidden; padding: 3cqh 3cqw; display: flex; flex-direction: column; justify-content: safe center; gap: calc(2.4cqh * var(--k) * var(--s)); }
  p { margin: 0; white-space: pre-line; }
  .pic { width: 100%; height: 100%; object-fit: contain; min-height: 0; }
  .te { font-family: "Hind Guntur", "Nirmala UI", sans-serif; font-weight: 600; font-size: calc(7.4cqh * var(--k) * var(--s)); line-height: 1.5; }
  .en { font-size: calc(5cqh * var(--k) * var(--s)); line-height: 1.35; color: #c9d1db; font-weight: 500; }
  .en.main { font-size: calc(6.6cqh * var(--k) * var(--s)); color: #fff; }
  .te-ref { font-family: "Hind Guntur", sans-serif; }
  footer { display: flex; align-items: baseline; gap: 1.6cqw; padding: 2cqh 3cqw 2.6cqh; border-top: 1px solid #2a2f37; background: #0b0d10; min-width: 0; }
  .label { font-size: 2.6cqh; font-weight: 700; color: #7cc4ff; flex: none; }
  .n-ref { font-size: 3.2cqh; font-weight: 700; color: #dfe4ee; flex: none; }
  .n-text { font-family: "Hind Guntur", "Segoe UI", sans-serif; font-size: 3.2cqh; color: #9aa3ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .dim { color: #6b7380; }
</style>
