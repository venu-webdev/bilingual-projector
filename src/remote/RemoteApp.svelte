<script>
  // The phone remote, opened from a phone on the church Wi-Fi. Anyone can watch what is on screen;
  // the buttons work only with the PIN shown in the app (Phone tab), which changes every time the
  // remote is switched on. Frames arrive over the same event stream as the OBS overlay.
  import Stage from '../lib/Stage.svelte';

  // A QR code from the app carries the PIN after the # (never sent to the server): take it, then
  // clear it from the address bar so it is not left in the phone's history.
  const fromQr = /(?:^|[#&])pin=(\d{6})/.exec(location.hash)?.[1];
  if (fromQr) { sessionStorage.setItem('remote-pin', fromQr); history.replaceState(null, '', location.pathname + location.search); }

  let f = $state(null);
  let connected = $state(false);
  let pin = $state(sessionStorage.getItem('remote-pin') || '');
  let asking = $state(!pin);
  let entry = $state('');
  let note = $state(null); // { text, bad }
  let busy = $state(false);

  const events = new EventSource('./events');
  events.addEventListener('open', () => (connected = true));
  events.addEventListener('error', () => (connected = false));
  events.addEventListener('remote', (e) => { f = JSON.parse(e.data); connected = true; });

  let noteTimer;
  const say = (text, bad = false) => { note = { text, bad }; clearTimeout(noteTimer); noteTimer = setTimeout(() => (note = null), 2600); };

  async function send(action, index = null) {
    if (!pin) { asking = true; return false; }
    if (navigator.vibrate) navigator.vibrate(12);
    busy = true;
    try {
      const r = await fetch('./remote/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action, index }) });
      const body = await r.json().catch(() => ({}));
      if (r.status === 403 && body.error === 'Wrong PIN') { pin = ''; sessionStorage.removeItem('remote-pin'); asking = true; say('That PIN did not work. Check the Phone tab in the app.', true); return false; }
      if (!r.ok) { say(body.error || 'The app did not accept that.', true); return false; }
      return true;
    } catch { say('Cannot reach the app. Is the phone on the same Wi-Fi?', true); return false; }
    finally { busy = false; }
  }

  async function unlock() {
    const p = entry.replace(/\D/g, '');
    if (p.length !== 6) { say('The PIN has 6 digits.', true); return; }
    pin = p;
    if (await send('check')) { sessionStorage.setItem('remote-pin', p); asking = false; entry = ''; say('Unlocked. You can control the screen.'); }
  }

  const live = $derived(f?.live || null);
  const slides = $derived(f?.deck?.slides || []);
  let list = $state(null);
  $effect(() => {
    void f?.liveIndex;
    if (!list || f?.liveIndex == null) return;
    queueMicrotask(() => list?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));
  });
</script>

<div class="r">
  <header>
    <span class="dot" class:ok={connected} aria-hidden="true"></span>
    <span class="title">{f?.deck?.title || 'Projector remote'}</span>
    {#if pin}<button class="lock" onclick={() => { pin = ''; sessionStorage.removeItem('remote-pin'); asking = true; }}>Lock</button>{/if}
  </header>

  <div class="screen" class:black={f?.black}>
    {#if f?.screen}<Stage frame={f.screen} />{/if}
    {#if f?.black}<span class="state">Screen is black</span>{:else if f?.hidden}<span class="state">Text hidden</span>{/if}
  </div>
  <div class="now">
    <span class="ref">{live ? (live.refTe && live.refTe !== live.refEn ? `${live.refTe} · ${live.refEn}` : live.refEn) : 'Nothing on screen'}</span>
    {#if f?.next}<span class="nx">Next: {f.next.refEn}</span>{/if}
  </div>

  <div class="go">
    <button class="btn" disabled={busy} onclick={() => send('prev')}>Previous</button>
    <button class="btn main" disabled={busy} onclick={() => send('next')}>Next</button>
  </div>
  <div class="cut">
    <button class="btn bad" class:on={f?.black} disabled={busy} onclick={() => send('black')}>Black</button>
    <button class="btn" class:on={f?.hidden} disabled={busy} onclick={() => send('hide')}>Hide text</button>
    <button class="btn" disabled={busy || (!f?.black && !f?.hidden)} onclick={() => send('back')}>Bring back</button>
  </div>

  {#if slides.length}
    <ol class="list" bind:this={list} aria-label="Slides">
      {#each slides as s (s.i)}
        <li><button class:on={f.deckIsLive && s.i === f.liveIndex} onclick={() => send('go', s.i)}><span class="n">{s.num}</span><span class="t">{s.line}</span></button></li>
      {/each}
    </ol>
  {:else}
    <p class="empty">Open a passage, a song or pictures in the app and its slides appear here.</p>
  {/if}

  {#if asking}
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Enter the PIN">
      <div class="card">
        <h1>Enter the PIN</h1>
        <p>It is in the app, in the Phone tab. Without it this page only shows what is on screen.</p>
        <!-- svelte-ignore a11y_autofocus -->
        <input inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digits" bind:value={entry} autofocus onkeydown={(e) => { if (e.key === 'Enter') unlock(); }} />
        <button class="btn main" onclick={unlock}>Unlock</button>
        <button class="btn quiet" onclick={() => (asking = false)}>Just watch</button>
      </div>
    </div>
  {/if}

  {#if note}<div class="note" class:bad={note.bad} role="status">{note.text}</div>{/if}
</div>

<style>
  :global(body) { color: #eef1f5; font: 16px/1.45 "Segoe UI", system-ui, sans-serif; -webkit-tap-highlight-color: transparent; }
  .r { max-width: 640px; margin: 0 auto; padding: 12px 14px calc(18px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; min-height: 100dvh; box-sizing: border-box; }
  header { display: flex; align-items: center; gap: 10px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #d9534f; flex: none; }
  .dot.ok { background: #46c37b; }
  .title { flex: 1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lock { border: 1px solid #3b424d; background: transparent; color: #c9d1dc; border-radius: 6px; padding: 4px 10px; font: inherit; font-size: 13px; }
  .screen { position: relative; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: #000; outline: 2px solid #f5c04a; outline-offset: 2px; }
  .state { position: absolute; left: 8px; top: 8px; padding: 2px 8px; border-radius: 4px; background: #b3261e; color: #fff; font-size: 13px; font-weight: 600; }
  .now { display: flex; flex-direction: column; gap: 2px; }
  .ref { font-weight: 600; color: #f5c04a; font-family: "Hind Guntur", "Segoe UI", sans-serif; }
  .nx { color: #9aa3ad; font-size: 14px; }
  .btn { min-height: 52px; border: 1px solid #3b424d; border-radius: 10px; background: #1e232a; color: #eef1f5; font: 600 17px/1 "Segoe UI", system-ui, sans-serif; touch-action: manipulation; }
  .btn:active { background: #2a3039; }
  .btn:disabled { opacity: 0.55; }
  .btn.main { background: #f5c04a; border-color: #f5c04a; color: #1d1608; }
  .btn.main:active { background: #e0ad3a; }
  .btn.bad { color: #ff8a80; border-color: #6b2e2b; background: #2a1715; }
  .btn.bad.on { background: #d9534f; color: #1a0907; }
  .btn.on:not(.bad) { background: #1d3550; border-color: #2f5f8f; color: #9ccaff; }
  .btn.quiet { background: transparent; }
  .go { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }
  .go .btn { min-height: 76px; font-size: 20px; }
  .cut { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .list { list-style: none; margin: 0; padding: 0; border: 1px solid #2a3039; border-radius: 10px; overflow-y: auto; max-height: 42dvh; }
  .list button { display: flex; gap: 12px; width: 100%; padding: 12px; border: 0; border-top: 1px solid #2a3039; background: transparent; color: inherit; text-align: left; font: inherit; }
  .list li:first-child button { border-top: 0; }
  .list button.on { background: #2b2412; box-shadow: inset 3px 0 0 #f5c04a; }
  .n { color: #9aa3ad; min-width: 2.2em; font-variant-numeric: tabular-nums; }
  .t { font-family: "Hind Guntur", "Segoe UI", sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty { color: #9aa3ad; font-size: 14px; }
  .sheet { position: fixed; inset: 0; background: rgb(0 0 0 / 0.7); display: grid; place-items: center; padding: 16px; }
  .card { width: min(420px, 100%); background: #1e232a; border: 1px solid #3b424d; border-radius: 14px; padding: 20px; display: grid; gap: 12px; }
  .card h1 { margin: 0; font-size: 20px; }
  .card p { margin: 0; color: #c9d1dc; font-size: 14px; }
  .card input { height: 56px; border: 1px solid #3b424d; border-radius: 10px; background: #14171b; color: #fff; font: 600 26px/1 ui-monospace, monospace; letter-spacing: 0.3em; text-align: center; }
  .note { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: 90vw; padding: 10px 14px; border-radius: 10px; background: #1d3a29; color: #bff0cf; font-size: 14px; }
  .note.bad { background: #3a1d1b; color: #ffc4be; }
</style>
