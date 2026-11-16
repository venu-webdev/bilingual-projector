<script>
  // The projector screen: it shows whatever frame the control window sends, nothing else.
  import Stage from '../lib/Stage.svelte';

  let frame = $state(null);
  window.projector.output.onFrame((f) => (frame = f));

  function onKeydown(e) {
    if (e.key === 'Escape') { window.projector.output.close(); return; }
    // A clicker or keyboard aimed at this screen still drives the show.
    if (!e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); window.projector.output.sendKey(e.key); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="out"><Stage {frame} /></div>

<style>
  .out { position: fixed; inset: 0; }
</style>
