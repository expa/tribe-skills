// Edge fade: a feathered inset applied to the SOURCE sampling, before the image is mapped
// into dots/lines. Points near the frame border are thinned out (probabilistically, so the
// transition is soft), leaving fewer graphics toward the edges so the background shows
// through as clean inset padding. Because it shapes the generated points, both the live
// canvas and every export inherit it automatically — no overlay needed.

import type { Vignette } from './types';

/** Default fade depth as a fraction of the shorter frame edge. */
export const EDGE_FADE_DEFAULT = 0.2;
/** Default falloff contrast (0-1): 0.5 = neutral smoothstep, higher = harder/cleaner
 *  outer band, lower = softer (fills closer to the border). */
export const EDGE_FADE_CONTRAST_DEFAULT = 0.5;

/** Most vignette passes the UI exposes (they stack multiplicatively). */
export const MAX_VIGNETTES = 2;

/** A fresh vignette pass at the neutral defaults (a border fade). */
export function defaultVignette(): Vignette {
  return { amount: EDGE_FADE_DEFAULT, contrast: EDGE_FADE_CONTRAST_DEFAULT, invert: false };
}

function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Keep-weight (0-1) for a point at frame pixel (fx, fy) in a w×h frame. 1 well inside the
 *  art, easing to 0 at the border across a band of `fade`×(shorter edge) — measured in
 *  pixels so the inset is uniform on every side regardless of aspect ratio. `contrast`
 *  (0-1) bends the falloff curve: >0.5 raises the weight to a power >1 so the outer band
 *  clears harder and the transition tightens; <0.5 softens it. */
export function edgeKeepWeight(
  fx: number,
  fy: number,
  w: number,
  h: number,
  fade: number,
  contrast: number = EDGE_FADE_CONTRAST_DEFAULT,
  invert: boolean = false,
): number {
  if (fade <= 0) return 1;
  const band = Math.min(w, h) * fade;
  if (band <= 0) return 1;
  const d = Math.min(fx, w - fx, fy, h - fy); // distance to the nearest edge, in px
  const t = smoothstep(d / band);
  // Inverted: keep a feathered band along the edges and clear the center instead,
  // so the vignette empties the middle of the frame rather than the border.
  const base = invert ? 1 - t : t;
  const k = 2 ** ((contrast - 0.5) * 5); // 0 → ~0.18 (soft), 0.5 → 1, 1 → ~5.7 (harsh)
  return k === 1 ? base : base ** k;
}
