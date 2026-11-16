// Pictures on screen: how one picture is fitted and adjusted, and which words of a verse are worth
// searching pictures for.

export const DEFAULT_ADJUST = {
  fit: 'cover',     // cover | contain | fill | none
  zoom: 1,          // 0.5 to 3
  x: 0, y: 0,       // move, -50 to 50. Fill screen / actual size: pans across the parts the screen crops off.
                    // Whole picture / stretch: shifts the picture on the screen.
  rotate: 0,        // degrees
  flipX: false, flipY: false,
  brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, grayscale: 0,
  dim: 0,           // darken the whole picture, 0 to 0.8
  backdrop: 'blur', // behind a contained picture: blur (a soft copy of it) | black
};

export const adjustOf = (a) => ({ ...DEFAULT_ADJUST, ...(a || {}) });

const clamp = (v, n) => Math.max(-n, Math.min(n, v));

export function pictureStyle(a) {
  const j = adjustOf(a);
  const flip = `scale(${j.zoom * (j.flipX ? -1 : 1)}, ${j.zoom * (j.flipY ? -1 : 1)})`;
  const filter = `brightness(${j.brightness}%) contrast(${j.contrast}%) saturate(${j.saturate}%) hue-rotate(${j.hue}deg) blur(${j.blur}px) grayscale(${j.grayscale}%)`;
  if (j.fit === 'cover' || j.fit === 'none') {
    // The picture overflows the screen: moving slides the visible window across the picture
    // (object-position), so the top or bottom of a tall photo comes into view and no black edge
    // ever shows. Zoom grows from the same point, so it zooms into what is being looked at.
    const px = 50 - clamp(j.x, 50), py = 50 - clamp(j.y, 50);
    return { fit: j.fit, position: `${px}% ${py}%`, origin: `${px}% ${py}%`, transform: `rotate(${j.rotate}deg) ${flip}`, filter };
  }
  // Whole picture / stretch: the picture sits inside the screen, so moving shifts it on the screen.
  return { fit: j.fit, position: '50% 50%', origin: '50% 50%', transform: `translate(${clamp(j.x, 50)}%, ${clamp(j.y, 50)}%) rotate(${j.rotate}deg) ${flip}`, filter };
}

/** A sensible starting fit: a tall (portrait) picture is shown whole with a soft blur beside it. */
export const fitFor = (w, h) => (h > w * 1.05 ? { fit: 'contain', backdrop: 'blur' } : { fit: 'cover' });

// Words worth searching pictures for: the rarest real words of the English verse, leaving out
// KJV function words and archaic verb forms (maketh, leadeth, hast), which find nothing useful.
const STOP = new Set(`a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up upon very was we were what when where which while who whom why will with would you your yours unto thee thou thy thine ye hath hast doth art shall shalt wilt saith said say says lord god jesus christ man men one things thing even also every therefore wherefore behold verily yea nay let made make come came go went because neither nor whosoever whatsoever sake way day days time hand hands name people world earth heaven want psalm psalms selah song songs musician chief maschil michtam`.split(' '));

// real nouns that only look like archaic verbs
const KEEP = new Set(['nazareth', 'teeth', 'beneath', 'elizabeth', 'japheth', 'seth', 'forest', 'harvest', 'feast', 'chest', 'nest', 'west', 'east', 'rest', 'priest', 'beast', 'breast', 'guest', 'tempest', 'wilderness', 'lebanon']);

let df = null;
function buildDf(books) {
  df = new Map();
  for (const b of books) for (const ch of b.ch) for (const v of ch) for (const w of new Set(v[1].toLowerCase().match(/[a-z]+/g) || [])) df.set(w, (df.get(w) || 0) + 1);
}

export function pictureWords(english, books, n = 5) {
  if (!english) return [];
  if (!df && books) buildDf(books);
  const words = [...new Set((english.toLowerCase().match(/[a-z]+/g) || []))]
    .filter((w) => w.length > 3 && !STOP.has(w) && (KEEP.has(w) || !/(eth|est|edst)$/.test(w)));
  return words
    .map((w) => ({ w, score: df ? 1 / Math.log(2 + (df.get(w) || 1)) : w.length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.w);
}
