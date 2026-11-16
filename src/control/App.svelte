<script>
  import { onMount } from 'svelte';
  import { loadBible } from '../lib/bible.js';
  import { lib, show, init, save, toast, next, prev, toggleBlack, toggleHidden, bringBack, jumpTo, startOutput, stopOutput, frameOf, upcoming, migrate, reloadSoon, newSong, toggleStream, addPictureFiles, stageFrame, toggleSplit, remoteFrame, remoteCommand } from './state.svelte.js';
  import { parseLyrics } from '../lib/lyrics.js';
  import { loadThemeFonts } from '../lib/fit.js';
  import Icon from './Icon.svelte';
  import Library from './Library.svelte';
  import Order from './Order.svelte';
  import Deck from './Deck.svelte';
  import OutputPanel from './OutputPanel.svelte';
  import SongEditor from './SongEditor.svelte';

  let bibleReady = $state(false);
  let failed = $state('');
  let menuOpen = $state(false);
  let shortcutsOpen = $state(false);
  let typed = $state('');
  let search = $state(null);

  onMount(async () => {
    try {
      await Promise.all([init(), loadBible().then(() => (bibleReady = true))]);
    } catch (e) { failed = String(e.message || e); }
    window.projector.output.onKey(handleKey);
    window.projector.remote.onCommand(remoteCommand);
  });

  // Whatever is live goes to the output window whenever it changes.
  $effect(() => {
    if (!lib.ready) return;
    const f = frameOf(show.live?.slide);
    window.projector.output.sendFrame($state.snapshot({ ...(f || {}), theme: f?.theme || lib.settings.themes.bible, black: show.black, hidden: show.hidden }));
  });

  // The stage screen gets the words, what comes next, the state of the room's screen and the message.
  $effect(() => {
    if (!lib.ready) return;
    window.projector.stage.sendFrame($state.snapshot(stageFrame()));
  });

  // The phone remote sees the screen and the open item's slides.
  $effect(() => {
    if (!lib.ready) return;
    window.projector.remote.sendFrame($state.snapshot(remoteFrame()));
  });

  // The livestream overlay (OBS) follows the live slide with its own settings.
  $effect(() => {
    if (!lib.ready) return;
    const f = frameOf(show.live?.slide);
    window.projector.overlay.sendFrame($state.snapshot({
      // f.slide, not show.live.slide: a picture's current adjustments travel with it to the stream
      slide: f?.slide || null, theme: f?.theme || lib.settings.themes.bible,
      black: show.black, hidden: show.hidden, visible: lib.settings.stream.visible, stream: lib.settings.stream,
    }));
  });

  // When the look changes in a way that changes text size, re-measure and rebuild the open deck.
  let lookKey = '';
  $effect(() => {
    if (!lib.ready) return;
    const key = JSON.stringify(Object.values(lib.settings.themes).map((t) => [t.teSize, t.enSize, t.teFont, t.enFont, t.weight, t.lineHeight, t.layout, t.reference?.show, t.reference?.size, t.minFit, t.steady, t.position]));
    if (key === lookKey) return;
    const first = !lookKey;
    lookKey = key;
    if (!first) loadThemeFonts($state.snapshot(lib.settings.themes)).then(reloadSoon);
  });

  function handleKey(key) {
    if (/^\d$/.test(key)) { typed = (typed + key).slice(-3); return; }
    if (key === 'Enter' && typed) { jumpTo(typed); typed = ''; return; }
    if (key === 'Backspace' && typed) { typed = typed.slice(0, -1); return; }
    if (key === 'Escape') { typed = ''; menuOpen = false; shortcutsOpen = false; return; }
    const k = key.length === 1 ? key.toLowerCase() : key;
    if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown'].includes(k)) next();
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) prev();
    else if (k === 'b' || k === '.') toggleBlack();
    else if (k === 'c') toggleHidden();
    else if (k === 'r') bringBack();
    else if (k === 'o') toggleStream();
    else if (k === 's') toggleSplit();
    else return false;
    typed = '';
    return true;
  }

  function onKeydown(e) {
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.ctrlKey && (e.key === 'f' || e.key === 'k')) || (!typing && e.key === '/')) { e.preventDefault(); search?.focus(); return; }
    if (typing || e.ctrlKey || e.altKey || e.metaKey) { if (e.key === 'Escape' && t instanceof HTMLElement) t.blur(); return; }
    if (t instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter') && !typed) return; // let buttons click
    if (handleKey(e.key) !== false) e.preventDefault();
  }

  // The screen the output uses: the saved one if it is still connected, else the first screen that is not this one.
  const outScreen = $derived(show.displays.find((x) => x.id === (show.output.displayId || lib.settings?.output.displayId)) || show.displays.find((x) => !x.primary) || show.displays[0]);
  const outId = $derived(outScreen?.id || '');
  // Ctrl V anywhere outside a text box: lyrics become a new song, ready to check and show.
  function onPaste(e) {
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (show.editing) return;
    // a copied picture (a screenshot, an image copied in a browser) goes into the open picture set
    const pics = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (pics.length) { e.preventDefault(); addPictureFiles(pics, 'paste'); return; }
    const text = e.clipboardData?.getData('text/plain') || '';
    if (text.trim().split('\n').filter((l) => l.trim()).length < 2) return; // a word or a reference is not a song
    e.preventDefault();
    const p = parseLyrics(text);
    show.editing = newSong(text, p.title, p.author);
    toast(`${p.stanzas.length} slides from the paste. Check them, then Ctrl Enter to show.`, 'ok');
  }

  const outLabel = $derived.by(() => {
    const d = outScreen;
    return d ? `${d.label.replace(' (this screen)', '')}  ${d.width} × ${d.height}` : 'No screen';
  });

  async function doImport() {
    menuOpen = false;
    try {
      const r = await window.projector.library.importFile();
      if (!r) return;
      Object.assign(lib, { songs: r.library.songs, setlists: r.library.setlists, settings: r.library.settings });
      migrate();
      await loadThemeFonts($state.snapshot(lib.settings.themes));
      show.deck = null;
      toast(`Imported ${r.songs} songs and ${r.setlists} service orders`, 'ok');
    } catch (e) { toast(String(e.message || e), 'bad'); }
  }
  async function doExport() {
    menuOpen = false;
    const p = await window.projector.library.exportFile();
    if (p) toast('Library exported', 'ok');
  }
</script>

<svelte:window onkeydown={onKeydown} onpaste={onPaste}
  ondragover={(e) => { if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === 'file')) e.preventDefault(); }}
  ondrop={(e) => { const pics = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/')); if (pics.length) { e.preventDefault(); addPictureFiles(pics, 'file'); } }}
  onclick={(e) => { if (menuOpen && !(e.target instanceof Element && e.target.closest('.menu-wrap'))) menuOpen = false; }} />

{#if failed}
  <div class="fatal"><b>The app could not start.</b><span>{failed}</span></div>
{:else if !lib.ready}
  <div class="fatal"><span class="muted">Opening the library…</span></div>
{:else}
  <div class="app">
    <header class="bar">
      <div class="brand">Bilingual Projector</div>

      <div class="output" title="Where the projection goes">
        <Icon name="screen" />
        <select class="bare" aria-label="Output screen" value={outId} onchange={(e) => { lib.settings.output.displayId = e.currentTarget.value; save('settings'); if (show.output.open) startOutput(); }}>
          {#each show.displays as d (d.id)}<option value={d.id}>{d.label}  {d.width} × {d.height}</option>{/each}
        </select>
        <span class="sep"></span>
        <select class="bare" aria-label="Window mode" value={lib.settings.output.mode} onchange={(e) => { lib.settings.output.mode = e.currentTarget.value; save('settings'); if (show.output.open) startOutput(); }}>
          <option value="windowed">Window (OBS can capture)</option>
          <option value="fullscreen">Fullscreen</option>
        </select>
      </div>

      {#if show.output.open}
        <span class="chip chip--live"><span class="dot"></span>Live</span>
      {/if}
      {#if show.black}<span class="chip" style="color:var(--bad);border-color:var(--bad-line);background:var(--bad-soft)">Screen black</span>{/if}
      {#if show.hidden && !show.black}<span class="chip">Text hidden</span>{/if}

      <span class="grow"></span>

      {#if show.output.open}
        <button class="btn" onclick={stopOutput}><Icon name="stop" />Stop projection</button>
      {:else}
        <button class="btn btn--live" onclick={startOutput}><Icon name="play" />Start projection</button>
      {/if}

      <div class="menu-wrap">
        <button class="btn btn--icon" aria-label="More" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}><Icon name="more" /></button>
        {#if menuOpen}
          <div class="menu" role="menu">
            <button role="menuitem" onclick={doImport}>Import a backup…<small>From this app or Bilingual Projector Pro</small></button>
            <button role="menuitem" onclick={doExport}>Export the library…</button>
            <button role="menuitem" onclick={() => { menuOpen = false; shortcutsOpen = true; }}>Keyboard shortcuts</button>
          </div>
        {/if}
      </div>
    </header>

    <main class="work">
      <section class="col col--lib" aria-label="Library">
        {#if bibleReady}
          <Library bind:search />
          <!-- the order names its passages from the Bible, so it waits for it too -->
          <Order />
        {:else}
          <div class="empty">Loading the Bible…</div>
        {/if}
      </section>
      <section class="col col--deck" aria-label="Slides">
        {#if show.editing}<SongEditor />{:else}<Deck />{/if}
      </section>
      <section class="col col--out" aria-label="Output">
        <OutputPanel />
      </section>
    </main>

    <footer class="status">
      {#if show.output.open}
        <span class="on"><span class="dot"></span>Projecting to {outLabel}</span>
      {:else}
        <span>Projection off</span>
      {/if}
      <span><kbd>Space</kbd> next</span>
      <span><kbd>←</kbd> previous</span>
      <span><kbd>16</kbd> <kbd>Enter</kbd> go to verse</span>
      <span><kbd>B</kbd> black</span>
      <span><kbd>C</kbd> hide text</span>
      <span><kbd>O</kbd> stream {lib.settings.stream.visible ? 'on' : 'off'}</span>
      <span><kbd>/</kbd> search</span>
      <span class="grow"></span>
      {#if typed}<span class="typed">Go to <b class="mono">{typed}</b> <kbd>Enter</kbd></span>{/if}
      <span class="saved"><span class="dot"></span>Saved on this computer</span>
    </footer>

    {#if show.toast}
      <div class="toast toast--{show.toast.tone}" role="status">{show.toast.text}</div>
    {/if}

    {#if shortcutsOpen}
      <div class="scrim" onclick={(e) => { if (e.target === e.currentTarget) shortcutsOpen = false; }} role="presentation">
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <h2>Keyboard shortcuts</h2>
          <dl>
            <dt><kbd>Space</kbd> <kbd>→</kbd> <kbd>↓</kbd> <kbd>Page Down</kbd></dt><dd>Show the next slide (clickers send Page Down)</dd>
            <dt><kbd>←</kbd> <kbd>↑</kbd> <kbd>Page Up</kbd></dt><dd>Show the previous slide</dd>
            <dt><kbd>16</kbd> then <kbd>Enter</kbd></dt><dd>Show verse 16, or slide 16 of a song</dd>
            <dt><kbd>B</kbd></dt><dd>Black screen, press again to bring it back</dd>
            <dt><kbd>C</kbd></dt><dd>Hide the text and keep the background</dd>
            <dt><kbd>R</kbd></dt><dd>Bring everything back</dd>
            <dt><kbd>S</kbd></dt><dd>Long verses: switch between continuing on a new slide and shrinking to fit one slide</dd>
            <dt><kbd>O</kbd></dt><dd>Show or hide the livestream overlay (OBS) without touching the room's screen</dd>
            <dt><kbd>/</kbd> or <kbd>Ctrl F</kbd></dt><dd>Search the Bible or the songs</dd>
            <dt><kbd>Ctrl V</kbd></dt><dd>Lyrics: a new song. A picture: added to the open picture set</dd>
            <dt>Double-click</dt><dd>A picture: show it now (a single click only picks it as Next)</dd>
            <dt><kbd>Esc</kbd></dt><dd>Leave a text box; on the output screen, close it</dd>
          </dl>
          <button class="btn btn--live" onclick={() => (shortcutsOpen = false)}>Done</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .app { display: grid; grid-template-rows: 52px 1fr 30px; height: 100vh; }
  .fatal { height: 100vh; display: grid; place-content: center; gap: 6px; text-align: center; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--rule); background: var(--paper-3); }
  .brand { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; margin-right: 6px; white-space: nowrap; }
  .output { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 4px 0 10px; border: 1px solid var(--rule); border-radius: var(--r-ctl); background: var(--paper-2); color: var(--ink-2); }
  .output :global(svg) { width: 16px; height: 16px; }
  .bare { height: 30px; border: 0; background: transparent; padding: 0 6px; color: var(--ink); font-size: 13px; cursor: pointer; }
  .bare option { background: var(--paper-2); }
  .sep { width: 1px; height: 18px; background: var(--rule); }
  .grow { flex: 1; }
  .menu-wrap { position: relative; }
  .menu { position: absolute; right: 0; top: 40px; z-index: 50; min-width: 260px; padding: 4px; border: 1px solid var(--rule-2); border-radius: var(--r); background: var(--paper-2); box-shadow: 0 12px 32px rgb(0 0 0 / 0.45); }
  .menu button { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: var(--r-ctl); background: transparent; cursor: pointer; }
  .menu button:hover { background: var(--rule); }
  .menu small { display: block; color: var(--muted); font-size: 12px; }

  .work { display: grid; grid-template-columns: minmax(280px, 22%) minmax(0, 1fr) minmax(380px, 32%); min-height: 0; }
  .col { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--rule); }
  .col--out { border-right: 0; }

  .status { display: flex; align-items: center; gap: 16px; padding: 0 14px; border-top: 1px solid var(--rule); background: var(--paper-3); color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; }
  .status .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
  .on { color: var(--live); display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
  .saved { color: var(--ok); display: inline-flex; align-items: center; gap: 6px; }
  .typed { color: var(--ink); }

  .toast { position: fixed; left: 50%; bottom: 46px; transform: translateX(-50%); z-index: 60; padding: 9px 14px; border: 1px solid var(--rule-2); border-radius: var(--r-ctl); background: var(--paper-2); box-shadow: 0 10px 28px rgb(0 0 0 / 0.45); font-weight: 500; }
  .toast--ok { border-color: oklch(42% 0.07 150); color: var(--ok); }
  .toast--bad { border-color: var(--bad-line); color: var(--bad); }

  .scrim { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); }
  .sheet { width: min(560px, 92vw); padding: 22px; border: 1px solid var(--rule-2); border-radius: var(--r); background: var(--paper-2); }
  .sheet h2 { margin: 0 0 14px; font-size: 18px; font-weight: 600; }
  .sheet dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 18px; margin: 0 0 18px; align-items: center; }
  .sheet dt { display: flex; gap: 4px; align-items: center; color: var(--muted); font-size: 12px; }
  .sheet dd { margin: 0; color: var(--ink-2); }
</style>
