<script>
  // A small, single icon set drawn on one 16px grid with one stroke weight.
  let { name } = $props();
  const P = {
    screen: '<rect x="1.5" y="2.5" width="13" height="8.5" rx="1.2"/><path d="M5.5 14h5M8 11v3"/>',
    play: '<path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
    book: '<path d="M2.5 3h4A1.5 1.5 0 0 1 8 4.5V14a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V14a1.5 1.5 0 0 1 1.5-1.5h4z"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    more: '<circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/>',
    left: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
    right: '<path d="M6 3.5 10.5 8 6 12.5"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    edit: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9"/>',
    grip: '<circle cx="6" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="4" r="1" fill="currentColor"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="10" cy="12" r="1" fill="currentColor"/>',
    image: '<rect x="2" y="3" width="12" height="10" rx="1.2"/><circle cx="6" cy="6.5" r="1.2"/><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3"/>',
    video: '<rect x="1.5" y="3.5" width="9.5" height="9" rx="1.2"/><path d="M11 7l3.5-2v6L11 9"/>',
  };
</script>

<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html P[name] || ''}</svg>
