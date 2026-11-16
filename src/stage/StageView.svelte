<script>
  // The stage window: shows the frames the control window sends, through the same component the
  // operator's preview uses, so what the pastor sees is what the operator sees.
  import StageScreen from '../lib/StageScreen.svelte';
  let f = $state(null);
  window.projector.stage.onFrame((x) => (f = x));
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') window.projector.stage.close(); }} />

<div class="full"><StageScreen frame={f} /></div>

<style>
  :global(body) { background: #000; }
  .full { position: fixed; inset: 0; }
</style>
