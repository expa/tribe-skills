// SVG marker definitions for arrow end-caps, shared by the canvas and the
// export. Caps must match their arrow's color, so instead of relying on
// `context-stroke` (unevenly supported, and lost when rasterizing to PNG) we
// pre-generate one marker per (cap type × color) and reference the matching one.
// The color set is finite: the default edge tint, the selection highlight, and
// every palette stroke.

import { type EdgeCap, EDGE_STROKE, NODE_COLORS, CANVAS_BG } from './model'
import { colors } from '../colors'

type Cap = Exclude<EdgeCap, 'none'>
const CAPS: Cap[] = ['arrow', 'triangle', 'inv', 'circle', 'dot', 'diamond']
const REF_X: Record<Cap, number> = { arrow: 10, triangle: 10, inv: 2, circle: 6, dot: 6, diamond: 6 }

// Every stroke color a marker might need.
const CAP_COLORS = Array.from(
  new Set([EDGE_STROKE, colors.accentTeal, ...Object.values(NODE_COLORS).map((c) => c.stroke)]),
)

const colorId = (hex: string) => hex.replace('#', '').toLowerCase()

function capBody(cap: Cap, color: string): string {
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

export const markerId = (cap: Cap, color: string) => `dg-cap-${cap}-${colorId(color)}`

// `url(#…)` reference for a cap in the given stroke color, or '' for none.
export function markerRef(cap: EdgeCap | undefined, fallback: EdgeCap, color: string): string {
  const c = cap ?? fallback
  return c === 'none' ? '' : `url(#${markerId(c, color)})`
}

// All marker defs (cap × color) as an SVG string.
export function markerDefs(): string {
  let out = ''
  for (const color of CAP_COLORS) {
    for (const cap of CAPS) {
      out += `<marker id="${markerId(cap, color)}" viewBox="0 0 12 12" refX="${REF_X[cap]}" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">${capBody(cap, color)}</marker>`
    }
  }
  return out
}
