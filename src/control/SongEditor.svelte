<script>
  // Paste a song in any shape and see its slides at once. The lyrics are kept as pasted, and the
  // slides are worked out from them every time (stanzas, chorus repeats, the two languages), so
  // editing a line later is just editing text.
  import Stage from '../lib/Stage.svelte';
  import { songSlides } from '../lib/slides.js';
  import { parseLyrics } from '../lib/lyrics.js';
  import { lib, show, saveSong, deleteSong } from './state.svelte.js';
  import Icon from './Icon.svelte';

  const start = show.editing;
  let song = $state({ ...start, options: { repeat: true, marks: 'keep', second: 'show', ...(start.options || {}) } });
  const isNew = !start.id;
  // Songs from the first version keep English in a second box; offer it only when it is in use.
  const legacy = !!(start.english && start.english.trim());

  const theme = $derived($state.snapshot(lib.settings.themes.song));
  const slides = $derived(songSlides($state.snapshot(song), { split: lib.settings.split, theme }));
  let pick = $state(0);
  const preview = $derived(slides[Math.min(pick, Math.max(0, slides.length - 1))]);
  const repeats = $derived(slides.filter((s) => s.repeat && s.part === 1).length);
  const hasSecond = $derived(/[A-Za-z]/.test(song.lyrics) && /[ఀ-౿]/.test(song.lyrics));
  const hasMarks = $derived(/\|\|[^|]+\|\|/.test(song.lyrics));
  const hasRepeatMarks = $derived(/[([]\s*(x\s*)?\d\s*(x|times)?\s*[)\]]|\bx\s?\d\b/i.test(song.lyrics));

  let area = $state(null);
  $effect(() => { if (isNew && area && !song.lyrics) area.focus(); });

  // Pasting into an empty song fills the title and writer from the paste.
  function onPaste(e) {
    if (song.lyrics.trim()) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    const p = parseLyrics(text, song.options);
    queueMicrotask(() => {
      if (!song.title) song.title = p.title;
      if (!song.author) song.author = p.author;
    });
  }

  function onKey(e) {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); saveSong($state.snapshot(song), { present: true }); }
    else if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveSong($state.snapshot(song)); }
    else if (e.key === 'Escape') { e.preventDefault(); show.editing = null; }
  }
  const opt = (k, v) => (song.options[k] = v);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ed" onkeydown={onKey}>
  <div class="head">
    <span class="t">{isNew ? 'New song' : 'Edit song'}</span>
    <div class="tools">
      {#if !isNew}<button class="btn btn--sm btn--quiet btn--danger" onclick={() => { if (confirm(`Delete "${song.title}"? It is also removed from every service order.`)) deleteSong(song.id); }}><Icon name="trash" />Delete</button>{/if}
      <button class="btn btn--sm" onclick={() => (show.editing = null)}>Cancel</button>
      <button class="btn btn--sm" onclick={() => saveSong($state.snapshot(song))} disabled={!slides.length}>Save <kbd>Ctrl S</kbd></button>
      <button class="btn btn--sm btn--live" onclick={() => saveSong($state.snapshot(song), { present: true })} disabled={!slides.length}>Save and show <kbd class="on-live">Ctrl Enter</kbd></button>
    </div>
  </div>

  <div class="body">
    <div class="form">
      <div class="two">
        <div><label class="lbl" for="s-title">Title</label><input id="s-title" class="field" bind:value={song.title} placeholder="Filled in from the paste" /></div>
        <div><label class="lbl" for="s-author">Writer (optional)</label><input id="s-author" class="field" bind:value={song.author} /></div>
      </div>
      <div class="lyr">
        <label class="lbl" for="s-te">Lyrics <span class="muted">· paste from anywhere: website, WhatsApp, Word, the old app</span></label>
        <textarea id="s-te" class="field te" bind:this={area} bind:value={song.lyrics} onpaste={onPaste} spellcheck="false"
          placeholder={'Paste the whole song here.\n\nEmpty lines, numbers (1. 2.), or headings (Chorus, పల్లవి, చరణం) start a new slide.\n||పల్లవి|| at the end of a verse brings the chorus back.\nEnglish or transliteration lines go under the Telugu.'}></textarea>
      </div>
      {#if legacy}
        <div class="lyr lyr--en">
          <label class="lbl" for="s-en">English (second box, from an older version) <span class="muted">· or move these lines into the lyrics under each Telugu stanza</span></label>
          <textarea id="s-en" class="field" bind:value={song.english} spellcheck="false"></textarea>
        </div>
      {/if}
      <div class="opts">
        <div class="opt" class:off={!hasMarks}>
          <span>Chorus repeats <span class="muted">({repeats} from ||markers||)</span></span>
          <span class="seg"><button aria-pressed={song.options.repeat} onclick={() => opt('repeat', true)}>Add</button><button aria-pressed={!song.options.repeat} onclick={() => opt('repeat', false)}>Don't</button></span>
        </div>
        <div class="opt" class:off={!hasRepeatMarks}>
          <span>Marks like (2) and x2</span>
          <span class="seg"><button aria-pressed={song.options.marks !== 'hide'} onclick={() => opt('marks', 'keep')}>Show</button><button aria-pressed={song.options.marks === 'hide'} onclick={() => opt('marks', 'hide')}>Hide</button></span>
        </div>
        <div class="opt" class:off={!hasSecond}>
          <span>English / transliteration lines</span>
          <span class="seg"><button aria-pressed={song.options.second !== 'hide'} onclick={() => opt('second', 'show')}>Show</button><button aria-pressed={song.options.second === 'hide'} onclick={() => opt('second', 'hide')}>Hide</button></span>
        </div>
      </div>
    </div>

    <div class="side">
      <div class="lbl">{slides.length ? `${slides.length} slides` : 'Slides appear here as you paste'}</div>
      <div class="screen">
        {#if preview}<Stage frame={{ slide: preview, theme: lib.settings.themes.song }} animate={false} />{/if}
      </div>
      <ol class="mini">
        {#each slides as s, i (s.id)}
          <li>
            <button class:on={i === Math.min(pick, slides.length - 1)} onclick={() => (pick = i)}>
              <span class="mono n">{s.num}</span>
              <span class="txt"><span class="te">{s.te.split('\n')[0]}</span>{#if s.en}<span class="en">{s.en.split('\n')[0]}</span>{/if}</span>
              {#if s.label && s.part === 1}<span class="tag" class:again={s.repeat}>{s.label}</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
    </div>
  </div>
</div>

<style>
  .ed { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .head { display: flex; align-items: center; justify-content: space-between; min-height: 52px; padding: 8px 16px; border-bottom: 1px solid var(--rule); }
  .t { font-size: 17px; font-weight: 600; }
  .tools { display: flex; gap: 6px; }
  .on-live { background: transparent; border-color: oklch(40% 0.08 75); color: var(--live-ink); }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(300px, 34%); }
  .form { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; min-height: 0; }
  .two { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; }
  .lyr { flex: 3; display: flex; flex-direction: column; min-height: 0; }
  .lyr--en { flex: 1; }
  .lyr textarea { flex: 1; resize: none; font-size: 15px; }
  .opts { display: grid; gap: 6px; }
  .opt { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--ink-2); }
  .opt.off { opacity: 0.55; }
  .side { border-left: 1px solid var(--rule); padding: 14px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .screen { aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden; background: #000; flex: none; }
  .mini { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
  .mini button { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; width: 100%; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; cursor: pointer; text-align: left; font-size: 12px; }
  .mini button.on, .mini button:hover { background: var(--paper-2); }
  .n { color: var(--muted); }
  .txt { min-width: 0; }
  .txt span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txt .en { color: var(--muted); }
  .tag { font-size: 11px; color: var(--muted); border: 1px solid var(--rule-2); border-radius: 4px; padding: 0 5px; white-space: nowrap; }
  .tag.again { color: var(--next); border-color: var(--next-line); }
</style>
