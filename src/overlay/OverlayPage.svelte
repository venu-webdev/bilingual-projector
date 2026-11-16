<script>
  // Runs inside OBS (on this computer or another one on the network). Frames arrive over a
  // server-sent event stream; if the app restarts, the browser reconnects by itself and the last
  // frame is sent again.
  //   overlay.html          the see-through overlay: reference card, lower third, as set in the app
  //   overlay.html?screen   the projector's own output, full screen, exactly as the room sees it
  import Overlay from '../lib/Overlay.svelte';
  import Stage from '../lib/Stage.svelte';

  const screen = new URLSearchParams(location.search).has('screen');
  let frame = $state(null);
  const events = new EventSource('./events');
  events.addEventListener('frame', (e) => { frame = JSON.parse(e.data); });
  if (screen) document.body.style.background = '#000';
</script>

<div class="page">
  {#if screen}
    <Stage frame={frame ? { slide: frame.slide, theme: frame.theme, black: frame.black, hidden: frame.hidden } : null} />
  {:else}
    <Overlay {frame} />
  {/if}
</div>

<style>.page { position: fixed; inset: 0; }</style>
