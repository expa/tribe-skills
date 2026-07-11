// SVG marker definitions for arrow end-caps. Caps must match their arrow's
// color, so instead of relying on `context-stroke` (unevenly supported, and lost
// when rasterizing to PNG) we pre-generate one marker per (cap type × color) and
// reference the matching one. Port of website lib/diagram/markers.ts.

import { EDGE_STROKE, NODE_COLORS, CANVAS_BG } from './model.mjs'
import { colors } from './colors.mjs'

const CAPS = ['arrow', 'triangle', 'inv', 'circle', 'dot', 'diamond']
const REF_X = { arrow: 10, triangle: 10, inv: 2, circle: 6, dot: 6, diamond: 6 }

// Every stroke color a marker might need.
const CAP_COLORS = Array.from(
  new Set([EDGE_STROKE, colors.accentTeal, ...Object.values(NODE_COLORS).map((c) => c.stroke)]),
)

const colorId = (hex) => hex.replace('#', '').toLowerCase()

function capBody(cap, color) {
  switch (cap) {
    case 'arrow':
      return `<path d="M1,1 L11,6 L1,11" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'triangle':
      return `<path d="M1,1 L11,6 L1,11 z" fill="${color}"/>`
    case 'inv':
      return `<path d="M11,1 L1,6 L11,11 z" fill="${color}"/>`
    case 'circle':
      return `<circle cx="6" cy="6" r="4.5" fill="${CANVAS_BG}" stroke="${color}" stroke-width="1.5"/>`
    case 'dot':
      return `<circle cx="6" cy="6" r="4" fill="${color}"/>`
    case 'diamond':
      return `<path d="M6,1 L11,6 L6,11 L1,6 z" fill="${color}"/>`
  }
}

export const markerId = (cap, color) => `dg-cap-${cap}-${colorId(color)}`

// `url(#…)` reference for a cap in the given stroke color, or '' for none.
export function markerRef(cap, fallback, color) {
  const c = cap ?? fallback
  return c === 'none' ? '' : `url(#${markerId(c, color)})`
}

// All marker defs (cap × color) as an SVG string.
export function markerDefs() {
  let out = ''
  for (const color of CAP_COLORS) {
    for (const cap of CAPS) {
      out += `<marker id="${markerId(cap, color)}" viewBox="0 0 12 12" refX="${REF_X[cap]}" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">${capBody(cap, color)}</marker>`
    }
  }
  return out
}
