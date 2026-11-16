<script>
  import Stage from '../lib/Stage.svelte';
  import Overlay from '../lib/Overlay.svelte';
  import StageScreen from '../lib/StageScreen.svelte';
  import QRCode from 'qrcode';
  import { lib, show, save, next, prev, toggleBlack, toggleHidden, bringBack, upcoming, frameOf, startStage, stopStage, toggleStream, toast, stageFrame } from './state.svelte.js';
  import Icon from './Icon.svelte';

  let draft = $state('');
  const sendMessage = (m) => { show.message = m.trim(); draft = ''; };

  const live = $derived(show.live?.slide || null);
  const nxt = $derived(upcoming());
  const liveFrame = $derived({ ...(frameOf(live) || { theme: lib.settings.themes.bible }), black: show.black, hidden: show.hidden });
  const nextFrame = $derived(frameOf(nxt));
  // Quick adjustments act on the theme of whatever is live (Bible or song).
  const kind = $derived((live?.kind || show.deck?.kind) === 'song' ? 'song' : 'bible');
  const theme = $derived(lib.settings.themes[kind]);
  const stream = $derived(lib.settings.stream);
  const overlayFrame = $derived({ slide: live, theme: frameOf(live)?.theme, black: show.black, hidden: show.hidden, visible: stream.visible, stream });

  let tab = $state('look');
  // Compact previews: the monitors shrink so the settings below get most of the column (remembered).
  const compact = $derived(!!lib.settings.ui?.compactPreviews);
  const toggleCompact = () => { lib.settings.ui = { ...(lib.settings.ui || {}), compactPreviews: !compact }; save('settings'); };
  let info = $state({ url: '', clients: 0, lan: { on: false, addresses: [] } });
  let lanBusy = $state(false);
  // the phone remote: off until switched on; a new PIN each time
  let remote = $state({ on: false, pin: '', addresses: [], local: '' });
  let qr = $state('');
  const phoneUrl = $derived(remote.addresses[0]?.url || '');
  $effect(() => {
    const u = phoneUrl, p = remote.pin;
    if (!remote.on || !u) { qr = ''; return; }
    QRCode.toDataURL(`${u}#pin=${p}`, { margin: 1, width: 360, color: { dark: '#0d0f12', light: '#ffffff' } }).then((d) => (qr = d)).catch(() => (qr = ''));
  });
  async function setRemote(on) {
    remote = await window.projector.remote.set(on);
    info = await window.projector.overlay.info();
    if (on && !remote.addresses.length) toast('The remote is on, but this computer is not on a network. Connect it to the church Wi-Fi.', 'bad');
    else if (on) toast('Phone remote on. Scan the code with the phone camera.', 'ok');
  }
  // How many OBS sources are connected, checked every few seconds while the Stream tab is open.
  $effect(() => {
    if (tab !== 'stream') return;
    const get = async () => (info = await window.projector.overlay.info());
    get();
    const t = setInterval(get, 3000);
    return () => clearInterval(t);
  });

  function size(d) {
    const k = Math.max(0.5, Math.min(1.8, (theme.teSize + d * 6) / theme.teSize));
    theme.teSize = Math.round(theme.teSize * k);
    theme.enSize = Math.round(theme.enSize * k);
    save('settings');
  }
  const set = (fn) => { fn(); save('settings'); };
  async function copy(text, what = 'Overlay address') {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied. In OBS: Sources, +, Browser, paste it.`, 'ok'); }
    catch { toast('Select the address and copy it', 'bad'); }
  }
  const copyUrl = () => copy(info.url);
  // OBS on another computer: the read-only network listener, remembered for next time
  async function lan(on) {
    lanBusy = true;
    const r = await window.projector.overlay.setLan(on);
    info = { ...info, lan: r };
    stream.lan = !!r.on;
    save('settings');
    lanBusy = false;
    if (on && !r.on) toast(`Could not share on the network: ${r.error || 'unknown error'}`, 'bad');
    else if (on) toast('Shared on the network. If Windows asks, allow access on Private networks.', 'ok');
  }
</script>

<div class="wrap" class:compact>
  <div class="mon">
    <div class="mon__head">
      <span class="chip chip--live"><span class="dot"></span>On screen</span>
      <span class="mono muted">{live ? live.refEn : 'Nothing yet'}</span>
    </div>
    <div class="screen screen--live" class:off={!show.output.open}>
      <Stage frame={liveFrame} />
      {#if !show.output.open}<span class="badge">Projection off: only you see this</span>{/if}
    </div>
  </div>

  <div class="nextrow">
    <div class="mon">
      <div class="mon__head">
        <span class="chip chip--next">Next</span>
        <span class="mono muted">{nxt ? nxt.refEn : 'End'}</span>
      </div>
      <div class="screen screen--next">
        {#if nextFrame}<Stage frame={nextFrame} animate={false} />{:else}<div class="end">End of {show.deck ? 'this item' : 'the list'}</div>{/if}
      </div>
    </div>
    <div class="go">
      <button class="btn" onclick={prev} disabled={!show.live || show.live.index === 0}><Icon name="left" />Previous</button>
      <button class="btn btn--live big" onclick={next} disabled={!nxt}>Show next <kbd>Space</kbd></button>
    </div>
  </div>

  <div class="cut">
    <button class="btn black" class:on={show.black} aria-pressed={show.black} onclick={toggleBlack}>Black screen <kbd>B</kbd></button>
    <button class="btn" class:on={show.hidden} aria-pressed={show.hidden} onclick={toggleHidden}>Hide text <kbd>C</kbd></button>
    <button class="btn" onclick={bringBack} disabled={!show.black && !show.hidden}>Bring back <kbd>R</kbd></button>
  </div>

  <!-- the monitors and the black / hide buttons above never scroll away; only this part scrolls -->
  <div class="pane">
  <div class="tabbar">
  <div class="tabs" role="tablist" aria-label="More controls">
    <button role="tab" aria-selected={tab === 'look'} onclick={() => (tab = 'look')}>Quick look</button>
    <button role="tab" aria-selected={tab === 'stream'} onclick={() => (tab = 'stream')}>
      Stream (OBS) <span class="pill" class:on={stream.visible}>{stream.visible ? 'on' : 'off'}</span>
    </button>
    <button role="tab" aria-selected={tab === 'stage'} onclick={() => (tab = 'stage')}>
      Stage {#if show.stage.open}<span class="pill on">open</span>{/if}
    </button>
    <button role="tab" aria-selected={tab === 'phone'} onclick={() => (tab = 'phone')}>
      Phone {#if remote.on}<span class="pill on">on</span>{/if}
    </button>
  </div>
  <button class="grow-btn" onclick={toggleCompact} aria-pressed={compact} title={compact ? 'Bring the previews back to full size' : 'Shrink the previews to give these settings more room'}>{compact ? '▼ Previews' : '▲ More room'}</button>
  </div>

  {#if tab === 'look'}
    <div class="tune">
      <div class="tune__head">{kind === 'song' ? 'Song' : 'Bible'} look, changes show at once</div>
      <div class="row">
        <span>Text size</span>
        <span class="step"><button aria-label="Smaller" onclick={() => size(-1)}>−</button><span class="mono">{theme.teSize}</span><button aria-label="Larger" onclick={() => size(1)}>+</button></span>
      </div>
      <div class="row">
        <span>Languages</span>
        <span class="seg">
          {#each [['te', 'తెలుగు'], ['both', 'Both'], ['side', 'Side by side'], ['en', 'English']] as [v, l]}
            <button aria-pressed={theme.layout === v} onclick={() => set(() => (theme.layout = v))}>{l}</button>
          {/each}
        </span>
      </div>
      <div class="row">
        <span>Reference</span>
        <span class="seg">
          <button aria-pressed={theme.reference.show && theme.reference.lang === 'te'} onclick={() => set(() => Object.assign(theme.reference, { show: true, lang: 'te' }))}>తెలుగు</button>
          <button aria-pressed={theme.reference.show && theme.reference.lang === 'en'} onclick={() => set(() => Object.assign(theme.reference, { show: true, lang: 'en' }))}>English</button>
          <button aria-pressed={!theme.reference.show} onclick={() => set(() => (theme.reference.show = false))}>Off</button>
        </span>
      </div>
    </div>
  {:else if tab === 'stream'}
    <div class="tune">
      <div class="tune__head stage-head">
        <span>What the livestream sees, over the camera</span>
        <button class="btn btn--sm" class:btn--live={!stream.visible} onclick={toggleStream}>{stream.visible ? 'Hide from stream' : 'Show on stream'} <kbd>O</kbd></button>
      </div>
      <div class="ov"><Overlay frame={overlayFrame} preview /></div>
      <div class="row">
        <span>Bible</span>
        <span class="seg">
          {#each [['reference', 'Reference card'], ['lower', 'Verse, lower third'], ['full', 'Full screen'], ['off', 'Nothing']] as [v, l]}
            <button aria-pressed={stream.bible === v} onclick={() => set(() => (stream.bible = v))}>{l}</button>
          {/each}
        </span>
      </div>
      <div class="row">
        <span>Songs</span>
        <span class="seg">
          {#each [['lower', 'Lyrics, lower third'], ['title', 'Song title'], ['full', 'Full screen'], ['off', 'Nothing']] as [v, l]}
            <button aria-pressed={stream.song === v} onclick={() => set(() => (stream.song = v))}>{l}</button>
          {/each}
        </span>
      </div>
      <div class="row">
        <span>Pictures</span>
        <span class="seg">
          {#each [['full', 'Full screen'], ['off', 'Nothing']] as [v, l]}
            <button aria-pressed={(stream.image || 'full') === v} onclick={() => set(() => (stream.image = v))}>{l}</button>
          {/each}
        </span>
      </div>
      <div class="row">
        <span>Hide after</span>
        <span class="seg">
          {#each [[0, 'Never'], [8, '8 s'], [15, '15 s'], [30, '30 s']] as [v, l]}
            <button aria-pressed={stream.autoHide === v} onclick={() => set(() => (stream.autoHide = v))}>{l}</button>
          {/each}
        </span>
      </div>
      <div class="row">
        <span>Card corner · words</span>
        <span class="pair">
          <span class="seg">
            <button aria-pressed={stream.corner !== 'right'} onclick={() => set(() => (stream.corner = 'left'))}>Left</button>
            <button aria-pressed={stream.corner === 'right'} onclick={() => set(() => (stream.corner = 'right'))}>Right</button>
          </span>
          <span class="seg">
            {#each [['same', 'Same as projector'], ['te', 'తెలుగు'], ['both', 'Both'], ['en', 'English']] as [v, l]}
              <button aria-pressed={stream.lang === v} onclick={() => set(() => (stream.lang = v))}>{l}</button>
            {/each}
          </span>
        </span>
      </div>
      <div class="obs">
        <div class="obs__t">
          <b>Add to OBS once</b>
          <span class="muted">{info.clients ? `${info.clients} OBS source connected` : 'No OBS source connected yet'}</span>
        </div>
        <div class="url"><code class="mono">{info.url || 'starting…'}</code><button class="btn btn--sm" onclick={copyUrl} disabled={!info.url}>Copy</button></div>
        <ol class="steps">
          <li>In OBS: Sources, <b>+</b>, <b>Browser</b>, name it "Projector overlay".</li>
          <li>Paste the address as URL. Width 1920, height 1080.</li>
          <li>Put it above your camera. The page is see-through, so only the card or lyrics show.</li>
        </ol>
      </div>
      <div class="obs lan">
        <div class="obs__t">
          <b>OBS on another computer</b>
          <span class="seg">
            <button aria-pressed={!info.lan?.on} disabled={lanBusy} onclick={() => lan(false)}>Off</button>
            <button aria-pressed={!!info.lan?.on} disabled={lanBusy} onclick={() => lan(true)}>Share on network</button>
          </span>
        </div>
        {#if info.lan?.on}
          {#each info.lan.addresses as a (a.overlay)}
            <div class="lan__net muted">{a.name}{#if a.kind !== 'network'} <span class="tag-k">{a.kind === 'vpn' ? 'VPN: other devices on the Wi-Fi cannot use this' : 'virtual network on this PC'}</span>{/if}</div>
            <div class="url"><span class="kind">Overlay</span><code class="mono">{a.overlay}</code><button class="btn btn--sm" onclick={() => copy(a.overlay)}>Copy</button></div>
            <div class="url"><span class="kind">Full screen</span><code class="mono">{a.screen}</code><button class="btn btn--sm" onclick={() => copy(a.screen, 'Full screen address')}>Copy</button></div>
          {:else}
            <div class="muted">This computer is not on a network. Connect it to the same Wi-Fi or cable as the streaming computer.</div>
          {/each}
          <ol class="steps">
            <li>Both computers on the same Wi-Fi or network cable.</li>
            <li>On the streaming computer, in OBS add a <b>Browser</b> source with one of these addresses, 1920 × 1080.</li>
            <li><b>Overlay</b> goes above the camera (see-through). <b>Full screen</b> is the projector picture itself.</li>
            <li>The first time, Windows may ask about network access: allow <b>Private networks</b>.</li>
          </ol>
        {:else}
          <div class="muted">Off: only OBS on this laptop can see the overlay. Turn it on when the streaming computer is a different machine. Other computers can only view, never control.</div>
        {/if}
      </div>
    </div>
  {:else if tab === 'phone'}
    <div class="tune">
      <div class="tune__head stage-head">
        <span>Phone remote: next, previous, black and the slides, from a phone</span>
        <span class="seg">
          <button aria-pressed={!remote.on} onclick={() => setRemote(false)}>Off</button>
          <button aria-pressed={remote.on} onclick={() => setRemote(true)}>On</button>
        </span>
      </div>
      {#if remote.on}
        <div class="phone">
          {#if qr}<img class="qr" src={qr} alt="QR code that opens the remote on a phone, already unlocked" width="180" height="180" />{/if}
          <div class="phone__t">
            <div class="lbl">PIN</div>
            <div class="pin mono">{remote.pin.slice(0, 3)} {remote.pin.slice(3)}</div>
            <ol class="steps">
              <li>Phone on the same Wi-Fi as this computer.</li>
              <li>Scan the code with the phone camera: it opens unlocked.</li>
              <li>Or open the address below and type the PIN.</li>
            </ol>
            <button class="btn btn--sm" onclick={() => setRemote(true)}>New PIN</button>
          </div>
        </div>
        {#each remote.addresses as a (a.url)}
          <div class="url mono-row"><span class="kind" title={a.name}>{a.kind === 'vpn' ? 'VPN' : a.kind === 'virtual' ? 'Virtual' : 'Wi-Fi / LAN'}</span><code class="mono">{a.url}</code><button class="btn btn--sm" onclick={() => copy(a.url, 'Remote address')}>Copy</button></div>
        {/each}
        <p class="why">Anyone on the Wi-Fi can open the address and watch; only someone with the PIN can change the screen. Switching off ends it at once.</p>
      {:else}
        <p class="why">Off. Switch on to control the slides from a phone, for example from the front of the church.</p>
      {/if}
    </div>
  {:else}
    <div class="tune">
      <div class="tune__head stage-head">
        <span>Stage screen, for the pastor</span>
        {#if show.stage.open}
          <button class="btn btn--sm" onclick={stopStage}>Close</button>
        {:else}
          <button class="btn btn--sm" onclick={() => startStage()}>Open</button>
        {/if}
      </div>
      <div class="row">
        <span>Screen</span>
        <select class="field mini" aria-label="Stage screen" value={lib.settings.stage.displayId || ''} onchange={(e) => { if (show.stage.open) startStage(e.currentTarget.value); else { lib.settings.stage.displayId = e.currentTarget.value; save('settings'); } }}>
          <option value="" disabled>Choose a screen</option>
          {#each show.displays as d (d.id)}<option value={d.id}>{d.label}{show.output.open && show.output.displayId === d.id ? ' · projector' : ''}</option>{/each}
        </select>
      </div>
      <!-- exactly what the pastor sees, drawn by the same component as the stage window -->
      <div class="stage-pv" class:on={show.stage.open}><StageScreen frame={stageFrame()} /></div>
      <div class="row">
        <span>Stage text size</span>
        <span class="step">
          <button aria-label="Smaller" onclick={() => set(() => (lib.settings.stage.textSize = Math.max(0.6, Math.round(((lib.settings.stage.textSize || 1) - 0.1) * 10) / 10)))}>−</button>
          <span class="mono">{Math.round((lib.settings.stage.textSize || 1) * 100)}%</span>
          <button aria-label="Larger" onclick={() => set(() => (lib.settings.stage.textSize = Math.min(1.6, Math.round(((lib.settings.stage.textSize || 1) + 0.1) * 10) / 10)))}>+</button>
        </span>
      </div>
      <div class="row">
        <span>Stage shows</span>
        <span class="seg">
          <button aria-pressed={(lib.settings.stage.view || 'pastor') === 'pastor'} onclick={() => set(() => (lib.settings.stage.view = 'pastor'))}>Pastor view</button>
          <button aria-pressed={lib.settings.stage.view === 'screen'} onclick={() => set(() => (lib.settings.stage.view = 'screen'))}>Same as projector</button>
        </span>
      </div>
      <p class="why">{lib.settings.stage.view === 'screen' ? 'The full slide, exactly as the room and the OBS full-screen page see it.' : 'The words large, what comes next, the clock and your messages.'}</p>
      <div class="row">
        <span>English on stage</span>
        <span class="seg">
          <button aria-pressed={lib.settings.stage.showEnglish !== false} onclick={() => set(() => (lib.settings.stage.showEnglish = true))}>Show</button>
          <button aria-pressed={lib.settings.stage.showEnglish === false} onclick={() => set(() => (lib.settings.stage.showEnglish = false))}>Hide</button>
        </span>
      </div>
      <div class="msg">
        <input class="field" placeholder="Message to the stage only, e.g. 5 minutes" bind:value={draft} onkeydown={(e) => { if (e.key === 'Enter') sendMessage(draft); }} />
        <div class="quick">
          {#each ['5 minutes', 'Wrap up', 'Slow down', 'Microphone'] as m}<button class="btn btn--sm" onclick={() => sendMessage(m)}>{m}</button>{/each}
          {#if show.message}<button class="btn btn--sm btn--quiet" onclick={() => sendMessage('')}>Clear "{show.message}"</button>{/if}
        </div>
      </div>
    </div>
  {/if}
  </div>
</div>

<style>
  .wrap { height: 100%; padding: 14px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
  .pane { flex: 1; min-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; margin: 0 -6px; padding: 0 6px 6px; }
  .mon__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
  .screen { position: relative; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #000; }
  /* The previews size themselves from the window's height, so the settings below always keep room. */
  .screen--live { height: clamp(150px, 30vh, 380px); width: auto; max-width: 100%; margin: 0 auto; }
  .screen--next { height: clamp(90px, 16vh, 220px); width: auto; max-width: 100%; }
  .compact .screen--live { height: clamp(90px, 15vh, 180px); }
  .compact .nextrow { grid-template-columns: 1fr; }
  .compact .nextrow > .mon .screen--next { display: none; }
  .compact .go { flex-direction: row; }
  .compact .go .btn { flex: 1; }
  .compact .go .big { height: 40px; }
  .tabbar { display: flex; gap: 6px; align-items: stretch; position: sticky; top: 0; z-index: 2; background: var(--paper); padding-bottom: 6px; margin-bottom: -6px; }
  .tabbar .tabs { flex: 1; position: static; margin-bottom: 0; }
  .grow-btn { flex: none; padding: 0 10px; border: 1px solid var(--rule); border-radius: var(--r-ctl); background: var(--paper-3); color: var(--ink-2); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; }
  .grow-btn:hover { background: var(--rule); }
  .grow-btn[aria-pressed="true"] { color: var(--next); border-color: var(--next-line); }
  .screen--live { outline: 2px solid var(--live); outline-offset: 2px; }
  .screen--live.off { outline-color: var(--rule-2); }
  .screen--next { outline: 1px solid var(--next-line); outline-offset: 2px; }
  .badge { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; border-radius: 4px; background: rgb(0 0 0 / 0.7); color: var(--ink-2); font-size: 11px; }
  .end { height: 100%; display: grid; place-items: center; color: var(--muted); font-size: 12px; background: var(--paper-3); }
  .nextrow { display: grid; grid-template-columns: 1fr 150px; gap: 12px; align-items: end; }
  .go { display: flex; flex-direction: column; gap: 8px; }
  .go .big { height: 52px; }
  .go kbd { background: transparent; border-color: oklch(40% 0.08 75); color: var(--live-ink); }
  .cut { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cut .btn { height: 46px; }
  .cut .black { border-color: var(--bad-line); color: var(--bad); background: var(--bad-soft); }
  .cut .black.on { background: var(--bad); color: oklch(18% 0.03 25); }
  .cut .btn.on:not(.black) { background: var(--next-soft); border-color: var(--next-line); color: var(--next); }
  .tabs { display: grid; grid-template-columns: repeat(4, auto); gap: 2px; padding: 3px; background: var(--paper-3); border: 1px solid var(--rule); border-radius: var(--r-ctl); margin-bottom: -6px; flex: none; position: sticky; top: 0; z-index: 2; }
  .tabs button { height: 30px; border: 0; border-radius: 4px; background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .tabs button[aria-selected="true"] { background: var(--paper-2); color: var(--ink); box-shadow: inset 0 0 0 1px var(--rule-2); }
  .pill { font-size: 10px; padding: 1px 5px; border-radius: 3px; border: 1px solid var(--rule-2); color: var(--muted); }
  .pill.on { color: var(--live); border-color: var(--live-line); background: var(--live-soft); }
  .tune { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); }
  .tune__head { padding: 8px 12px; color: var(--muted); font-size: 12px; border-bottom: 1px solid var(--rule); }
  .row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; padding: 8px 12px; border-top: 1px solid var(--rule); font-size: 13px; }
  .row:nth-child(2) { border-top: 0; }
  .row > span:first-child { color: var(--ink-2); flex: none; }
  .pair { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .step { display: inline-flex; align-items: center; border: 1px solid var(--rule-2); border-radius: var(--r-ctl); overflow: hidden; }
  .step button { width: 30px; height: 28px; border: 0; background: var(--paper-3); cursor: pointer; font-size: 15px; }
  .step button:hover { background: var(--rule); }
  .step .mono { min-width: 44px; text-align: center; font-size: 12px; }
  .stage-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ink-2); }
  .field.mini { height: 28px; width: auto; max-width: 60%; font-size: 12px; }
  .phone { display: flex; gap: 14px; padding: 12px; align-items: flex-start; }
  .qr { width: 180px; height: 180px; border-radius: 8px; background: #fff; flex: none; image-rendering: pixelated; }
  .phone__t { display: grid; gap: 6px; }
  .phone .lbl { color: var(--muted); font-size: 12px; }
  .pin { font-size: 34px; font-weight: 600; letter-spacing: 0.08em; color: var(--live); line-height: 1.1; }
  .mono-row { padding: 0 12px 8px; }
  .tag-k { color: var(--bad); font-size: 11px; }
  .stage-pv { position: relative; aspect-ratio: 16 / 9; margin: 10px 12px; border-radius: 6px; overflow: hidden; outline: 1px solid var(--rule-2); outline-offset: 2px; }
  .stage-pv.on { outline-color: var(--next); }
  .why { margin: -2px 12px 6px; color: var(--muted); font-size: 12px; }
  .msg { padding: 8px 12px 12px; border-top: 1px solid var(--rule); display: grid; gap: 8px; }
  .quick { display: flex; flex-wrap: wrap; gap: 6px; }
  .ov { aspect-ratio: 16 / 9; margin: 10px 12px; border-radius: 6px; overflow: hidden; }
  .obs { padding: 10px 12px 12px; border-top: 1px solid var(--rule); display: grid; gap: 8px; font-size: 12px; }
  .obs__t { display: flex; justify-content: space-between; gap: 8px; }
  .url { display: flex; gap: 6px; align-items: center; }
  .url code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 8px; border: 1px solid var(--rule-2); border-radius: var(--r-ctl); background: var(--paper-3); user-select: text; font-size: 12px; }
  .steps { margin: 0; padding-left: 18px; color: var(--ink-2); line-height: 1.5; }
  .lan__net { font-size: 11px; margin-top: 2px; }
  .kind { width: 70px; flex: none; color: var(--ink-2); font-size: 12px; }
  .obs__t { align-items: center; }
</style>
