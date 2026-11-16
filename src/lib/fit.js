// Measures slide text exactly as Stage.svelte lays it out (same box, fonts, sizes, gaps), off screen.
// The deck uses it to split a long verse before it ever has to shrink on the projector.
// If you change the text rules in Stage.svelte, change them here too.

const W = 1680, H = 900; // the 1920 x 1080 canvas minus 120px / 90px padding
let box, te, en, ref;

function ensure() {
  if (box) return;
  box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;overflow:hidden;visibility:hidden;pointer-events:none;white-space:pre-line;text-align:center;contain:strict`;
  te = document.createElement('div');
  en = document.createElement('div');
  ref = document.createElement('div');
  box.append(te, en, ref);
  document.body.append(box);
}

// Lower-third looks put the words in a band 1720 x 340 at the bottom of the screen.
const boxOf = (theme) => (theme.position === 'lower' ? [1720, 340] : [W, H]);

function apply(slide, theme, f) {
  const layout = theme.layout || 'both';
  const showTe = !!slide.te && (layout !== 'en' || !slide.en);
  const showEn = !!slide.en && (layout !== 'te' || !slide.te);
  const [bw, bh] = boxOf(theme);
  box.style.width = `${bw}px`;
  box.style.height = `${bh}px`;
  const side = layout === 'side' && showTe && showEn;
  const lh = theme.lineHeight || 1.4;
  box.style.display = side ? 'grid' : 'flex';
  box.style.flexDirection = 'column';
  box.style.justifyContent = 'safe center';
  box.style.alignContent = 'safe center';
  box.style.gridTemplateColumns = side ? '1fr 1fr' : '';
  box.style.columnGap = side ? '80px' : '';
  box.style.rowGap = `${28 * f}px`;
  te.style.display = showTe ? '' : 'none';
  te.style.font = `${theme.weight || 600} ${(theme.teSize || 72) * f}px / ${lh + 0.1} "${theme.teFont}", "Nirmala UI", sans-serif`;
  te.textContent = slide.te || '';
  en.style.display = showEn ? '' : 'none';
  en.style.font = `${Math.min(theme.weight || 600, 600)} ${(theme.enSize || 48) * f}px / ${lh} "${theme.enFont}", "Segoe UI", sans-serif`;
  en.textContent = slide.en || '';
  const r = theme.reference || {};
  ref.style.display = r.show ? '' : 'none';
  ref.style.gridColumn = side ? '1 / -1' : '';
  ref.style.font = `500 ${r.size || 34}px "Hind Guntur", "Inter", sans-serif`;
  ref.textContent = r.show ? 'యోహాను 3:16 ●○' : '';
}

/** Does the slide fit the screen with text at `f` times the theme's size? */
export function fits(slide, theme, f = 1) {
  ensure();
  apply(slide, theme, f);
  return box.scrollHeight <= boxOf(theme)[1] + 1;
}

/** The largest text scale (0.25 to 1) at which the slide fits. */
export function fitOf(slide, theme) {
  if (fits(slide, theme, 1)) return 1;
  let lo = 0.25, hi = 1;
  for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (fits(slide, theme, m)) lo = m; else hi = m; }
  return lo;
}

/** Wait for the theme's faces, so measurements use the real fonts and not a fallback. */
export function loadThemeFonts(themes) {
  const faces = new Set();
  for (const t of Object.values(themes)) {
    faces.add(`${t.weight || 600} 72px "${t.teFont}"`);
    faces.add(`${Math.min(t.weight || 600, 600)} 48px "${t.enFont}"`);
  }
  faces.add('500 34px "Hind Guntur"');
  return Promise.all([...faces].map((f) => document.fonts.load(f, 'అA').catch(() => null)));
}
