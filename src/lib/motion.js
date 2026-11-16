// How words arrive on screen. One small set of entrances, each a Svelte transition, shared by the
// projector, the previews and the stream overlay so they all move the same way.
import { cubicOut } from 'svelte/easing';

export const MOTIONS = [
  ['fade', 'Fade'],
  ['rise', 'Rise'],
  ['zoom', 'Zoom'],
  ['blur', 'Blur in'],
  ['cascade', 'Cascade'],
  ['none', 'None'],
];
export const SPEEDS = { fast: 220, normal: 420, slow: 700 };

const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The entrance for one element. `delay` staggers the parts of a cascade. */
export function enter(node, { motion = 'fade', duration = 420, delay = 0, distance = 36 } = {}) {
  if (!duration || motion === 'none' || reduce()) return { duration: 0 };
  const kind = motion === 'cascade' ? 'rise' : motion;
  const css = {
    fade: (t) => `opacity:${t}`,
    rise: (t, u) => `opacity:${t};transform:translateY(${u * distance}px)`,
    zoom: (t, u) => `opacity:${t};transform:scale(${1 - u * 0.06})`,
    blur: (t, u) => `opacity:${t};filter:blur(${u * 14}px)`,
    left: (t, u) => `opacity:${t};transform:translateX(${-u * distance * 2}px)`,
  }[kind] || ((t) => `opacity:${t}`);
  return { duration, delay, easing: cubicOut, css };
}

/** The exit: always a quick fade, so the next words are never waiting on the last ones. */
export function leave(node, { duration = 420 } = {}) {
  if (!duration || reduce()) return { duration: 0 };
  return { duration: Math.min(220, duration * 0.5), css: (t) => `opacity:${t}` };
}
