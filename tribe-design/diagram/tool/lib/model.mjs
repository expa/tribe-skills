// Shared data model for the System Diagram generator. Plain-ESM port of the
// website's lib/diagram/model.ts (types stripped, logic identical).
//
// A diagram is a flat list of nodes (boxes) placed on a canvas by absolute
// x/y/w/h, plus edges (arrows) that reference nodes by id. Colours map to the
// Tribe palette so exports stay on-brand without the tool needing CSS.
//
// Shapes (JSDoc):
// @typedef {'rounded'|'rect'|'pill'|'diamond'|'ellipse'} NodeShape
// @typedef {'left'|'center'|'right'} TextAlign
// @typedef {'default'|'brand'|'teal'|'ocean'|'brown'|'orange'|'yellow'|'dark'} NodeColor
// @typedef {'tl'|'tc'|'tr'|'rc'|'br'|'bc'|'bl'|'lc'} BadgeAnchor
// @typedef {'none'|'arrow'|'triangle'|'inv'|'circle'|'dot'|'diamond'} EdgeCap
// @typedef {'top'|'right'|'bottom'|'left'} EdgeSide
//
// @typedef {Object} DiagramNode
// @property {string} id
// @property {'node'|'badge'} [kind]      default 'node'; 'badge' is a 40×40 circle
// @property {string} label
// @property {string} [subLabel]          secondary line, rendered smaller + lighter
// @property {TextAlign} [textAlign]      horizontal alignment of label + sub-label (default 'center')
// @property {NodeShape} shape
// @property {NodeColor} color
// @property {number} x @property {number} y @property {number} w @property {number} h
// @property {string} [parentId]          badge only: the node it is snapped to
// @property {BadgeAnchor} [anchor]       badge only: which point on the parent
//
// @typedef {Object} DiagramEdge
// @property {string} id
// @property {string} from  node id
// @property {string} to    node id
// @property {string} [label]
// @property {boolean} [dashed]
// @property {boolean} [bold]             thicker line
// @property {NodeColor} [color]          line + cap color (default = EDGE_STROKE tan)
// @property {EdgeCap} [startCap]         default 'none'
// @property {EdgeCap} [endCap]           default 'triangle'
// @property {NodeColor} [labelColor]     label chip palette (default paper)
// @property {boolean} [labelBorder]      outline the label chip
// @property {number} [labelT]            label position along the arrow, 0–1 (default 0.5)
// @property {{x:number,y:number}[]} [waypoints]  forced route points (absolute canvas coords)
// @property {EdgeSide} [fromSide] @property {EdgeSide} [toSide]  pin attach sides
//
// @typedef {Object} Diagram
// @property {DiagramNode[]} nodes
// @property {DiagramEdge[]} edges
// @property {string} [background]        canvas surface colour (hex); defaults to CANVAS_BG
// @property {boolean} [exportBackground] include background in exports (else transparent)
// @property {boolean} [showGrid]         editor-only; not exported
// @property {number} [cornerRadius]      rounding of arrow bends in px (0 = sharp 90°)

import { colors } from './colors.mjs'

export const TEXT_ALIGN_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
]

export const BADGE_SIZE = 40

// Anchor → fraction of the parent's width/height (from its top-left).
const ANCHOR_FRAC = {
  tl: [0, 0], tc: [0.5, 0], tr: [1, 0], rc: [1, 0.5],
  br: [1, 1], bc: [0.5, 1], bl: [0, 1], lc: [0, 0.5],
}
export const BADGE_ANCHORS = Object.keys(ANCHOR_FRAC)

// Centre point of an anchor on a parent node.
export function anchorPoint(parent, a) {
  const [fx, fy] = ANCHOR_FRAC[a]
  return { x: parent.x + fx * parent.w, y: parent.y + fy * parent.h }
}

// The anchor on `parent` whose centre is closest to (px, py).
export function nearestAnchor(parent, px, py) {
  let best = 'tr'
  let bestD = Infinity
  for (const a of BADGE_ANCHORS) {
    const p = anchorPoint(parent, a)
    const d = (p.x - px) ** 2 + (p.y - py) ** 2
    if (d < bestD) { bestD = d; best = a }
  }
  return best
}

// Border thickness for node shapes — thin hairline, on-screen and in exports.
export const NODE_STROKE_W = 0.5

export const EDGE_SIDE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'top', label: '↑' },
  { id: 'right', label: '→' },
  { id: 'bottom', label: '↓' },
  { id: 'left', label: '←' },
]

export const EDGE_CAP_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'inv', label: 'Inverted' },
  { id: 'circle', label: 'Circle' },
  { id: 'dot', label: 'Dot' },
  { id: 'diamond', label: 'Diamond' },
]

export const MAX_CORNER_RADIUS = 24

// Background swatches offered in the inspector (canvas settings).
export const BACKGROUND_OPTIONS = [
  { id: colors.backgroundPrimary, label: 'Paper' },
  { id: colors.backgroundSoft, label: 'Soft' },
  { id: colors.white, label: 'White' },
  { id: colors.backgroundSecondary, label: 'Sand' },
  { id: colors.foregroundPrimary, label: 'Ink' },
]

// Rough luminance test so default text can flip on dark surfaces.
export function isDarkColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

// The editable world. Nodes are laid out inside this fixed canvas.
export const CANVAS_W = 4000
export const CANVAS_H = 2800

// Translate a whole diagram so its content bounding box is centred in the canvas.
export function centerDiagram(d) {
  const ns = d.nodes
  if (ns.length === 0) return d
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of ns) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.w > maxX) maxX = n.x + n.w
    if (n.y + n.h > maxY) maxY = n.y + n.h
  }
  const dx = Math.round(CANVAS_W / 2 - (minX + maxX) / 2)
  const dy = Math.round(CANVAS_H / 2 - (minY + maxY) / 2)
  if (dx === 0 && dy === 0) return d
  return {
    ...d,
    nodes: ns.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
    // Waypoints are absolute canvas coords, so shift them by the same offset.
    edges: d.edges.map((e) =>
      e.waypoints?.length ? { ...e, waypoints: e.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })) } : e,
    ),
  }
}

export const NODE_SHAPES = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'pill', label: 'Pill' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'ellipse', label: 'Ellipse' },
]

// Fill / stroke / text per palette key. Hexes mirror the brand tokens so a
// rasterised export matches what the site would render.
export const NODE_COLORS = {
  default: { fill: colors.white, stroke: colors.backgroundTertiary, text: colors.foregroundPrimary },
  brand: { fill: colors.brand, stroke: colors.accentTeal, text: colors.brandContrast },
  teal: { fill: colors.accentTeal, stroke: colors.accentTeal, text: colors.accentTealContrast },
  ocean: { fill: colors.accentOcean, stroke: colors.accentOcean, text: colors.accentOceanContrast },
  brown: { fill: colors.accentBrown, stroke: colors.accentBrown, text: colors.accentBrownContrast },
  orange: { fill: colors.accentOrange, stroke: colors.accentOrange, text: colors.accentOrangeContrast },
  yellow: { fill: colors.accentYellow, stroke: colors.accentYellow, text: colors.accentYellowContrast },
  dark: { fill: colors.foregroundPrimary, stroke: colors.foregroundPrimary, text: colors.backgroundPrimary },
}

export const COLOR_OPTIONS = [
  { id: 'default', label: 'White' },
  { id: 'brand', label: 'Brand' },
  { id: 'teal', label: 'Teal' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'brown', label: 'Brown' },
  { id: 'orange', label: 'Orange' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'dark', label: 'Ink' },
]

// Canvas surface + edge ink (used both on-screen and in exports).
export const CANVAS_BG = colors.backgroundPrimary
export const EDGE_STROKE = colors.backgroundTertiary // arrow lines + caps
export const EDGE_WIDTH = 1 // default arrow line thickness
export const EDGE_WIDTH_BOLD = 2.5 // "bold line" thickness

// Line/cap color for an edge, from its palette key (or the default tan).
export function edgeStrokeColor(color) {
  return color && color !== 'default' ? NODE_COLORS[color].stroke : EDGE_STROKE
}
export const EDGE_LABEL_BG = colors.backgroundPrimary
export const EDGE_LABEL_TEXT = colors.foregroundPrimary

export const NODE_DEFAULT_W = 180
export const NODE_DEFAULT_H = 72
export const NODE_MIN_W = 80
export const NODE_MIN_H = 44

// Short random-ish id — counter-based; collisions don't matter within one diagram.
let counter = 0
export function makeId(prefix = 'n') {
  counter += 1
  return `${prefix}${counter.toString(36)}${(counter * 2654435761 % 46656).toString(36)}`
}

export function createNode(partial = {}) {
  return {
    id: partial.id ?? makeId('n'),
    label: partial.label ?? 'New node',
    subLabel: partial.subLabel,
    shape: partial.shape ?? 'rounded',
    color: partial.color ?? 'default',
    x: partial.x ?? (CANVAS_W - NODE_DEFAULT_W) / 2,
    y: partial.y ?? (CANVAS_H - NODE_DEFAULT_H) / 2,
    w: partial.w ?? NODE_DEFAULT_W,
    h: partial.h ?? NODE_DEFAULT_H,
  }
}

export function createBadge(partial = {}) {
  return {
    id: partial.id ?? makeId('b'),
    kind: 'badge',
    label: partial.label ?? '1',
    shape: 'ellipse',
    color: partial.color ?? 'brand',
    x: partial.x ?? (CANVAS_W - BADGE_SIZE) / 2,
    y: partial.y ?? (CANVAS_H - BADGE_SIZE) / 2,
    w: BADGE_SIZE,
    h: BADGE_SIZE,
    parentId: partial.parentId,
    anchor: partial.anchor,
  }
}

// Next auto-number for a new numeric badge.
export function nextBadgeNumber(diagram) {
  let max = 0
  for (const n of diagram.nodes) {
    if (n.kind !== 'badge') continue
    const v = parseInt(n.label, 10)
    if (Number.isFinite(v)) max = Math.max(max, v)
  }
  return max + 1
}

// Resolve snapped badges' geometry from their parent + anchor so they follow the
// parent. Call this before rendering / routing / exporting. Floating badges keep
// their own x/y; every badge is forced to BADGE_SIZE.
export function withBadgePositions(diagram) {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  return {
    ...diagram,
    nodes: diagram.nodes.map((n) => {
      if (n.kind !== 'badge') return n
      const parent = n.parentId ? byId.get(n.parentId) : undefined
      if (parent && parent.kind !== 'badge' && n.anchor) {
        const c = anchorPoint(parent, n.anchor)
        return { ...n, x: c.x - BADGE_SIZE / 2, y: c.y - BADGE_SIZE / 2, w: BADGE_SIZE, h: BADGE_SIZE }
      }
      return { ...n, w: BADGE_SIZE, h: BADGE_SIZE }
    }),
  }
}

// The point on a node's border along the direction toward (tx, ty). Uses a
// rectangle approximation for every shape — good enough for clean attach points.
export function borderPoint(node, tx, ty) {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = node.w / 2
  const hh = node.h / 2
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

// Validate + normalise a diagram coming from the AI (or an untrusted source):
// drop malformed nodes/edges, clamp geometry, and keep only edges whose
// endpoints exist. Returns a safe Diagram (possibly empty).
export function sanitizeDiagram(input) {
  const raw = input ?? {}
  const shapes = new Set(NODE_SHAPES.map((s) => s.id))
  const colorSet = new Set(COLOR_OPTIONS.map((c) => c.id))
  const num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback)

  const anchorSet = new Set(BADGE_ANCHORS)
  const alignSet = new Set(TEXT_ALIGN_OPTIONS.map((a) => a.id))
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .filter((n) => Boolean(n && typeof n.id === 'string'))
    .map((n) => {
      const isBadge = n.kind === 'badge'
      const w = isBadge ? BADGE_SIZE : Math.max(NODE_MIN_W, num(n.w, NODE_DEFAULT_W))
      const h = isBadge ? BADGE_SIZE : Math.max(NODE_MIN_H, num(n.h, NODE_DEFAULT_H))
      return {
        id: String(n.id),
        kind: isBadge ? 'badge' : undefined,
        label: typeof n.label === 'string' ? n.label : '',
        subLabel: !isBadge && typeof n.subLabel === 'string' && n.subLabel.trim() ? n.subLabel : undefined,
        // CLI addition (not in the site's sanitize): pass textAlign through so
        // authored JSON can left/right-align labels in exports.
        textAlign: !isBadge && alignSet.has(n.textAlign) ? n.textAlign : undefined,
        shape: shapes.has(n.shape) ? n.shape : 'rounded',
        color: colorSet.has(n.color) ? n.color : 'default',
        x: Math.max(0, Math.min(CANVAS_W - w, num(n.x, 40))),
        y: Math.max(0, Math.min(CANVAS_H - h, num(n.y, 40))),
        w,
        h,
        parentId: isBadge && typeof n.parentId === 'string' ? n.parentId : undefined,
        anchor: isBadge && anchorSet.has(n.anchor) ? n.anchor : undefined,
      }
    })

  const ids = new Set(nodes.map((n) => n.id))
  const caps = new Set(EDGE_CAP_OPTIONS.map((c) => c.id))
  const sides = new Set(['top', 'right', 'bottom', 'left'])
  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .filter((e) => Boolean(e) && ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
    .map((e) => ({
      id: typeof e.id === 'string' ? e.id : makeId('e'),
      from: e.from,
      to: e.to,
      label: typeof e.label === 'string' ? e.label : undefined,
      dashed: Boolean(e.dashed),
      bold: typeof e.bold === 'boolean' ? e.bold : undefined,
      color: colorSet.has(e.color) ? e.color : undefined,
      startCap: caps.has(e.startCap) ? e.startCap : undefined,
      endCap: caps.has(e.endCap) ? e.endCap : undefined,
      labelColor: colorSet.has(e.labelColor) ? e.labelColor : undefined,
      labelBorder: typeof e.labelBorder === 'boolean' ? e.labelBorder : undefined,
      // CLI addition: labelT passthrough (clamped 0–1) so authored JSON can
      // slide a label along its arrow.
      labelT: typeof e.labelT === 'number' && isFinite(e.labelT) ? Math.max(0, Math.min(1, e.labelT)) : undefined,
      waypoints: Array.isArray(e.waypoints)
        ? e.waypoints
            .filter((w) => Boolean(w) && typeof w === 'object')
            .map((w) => ({
              x: Math.max(0, Math.min(CANVAS_W, num(w.x, 0))),
              y: Math.max(0, Math.min(CANVAS_H, num(w.y, 0))),
            }))
        : undefined,
      fromSide: sides.has(e.fromSide) ? e.fromSide : undefined,
      toSide: sides.has(e.toSide) ? e.toSide : undefined,
    }))

  return {
    nodes,
    edges,
    background: typeof raw.background === 'string' ? raw.background : undefined,
    exportBackground: typeof raw.exportBackground === 'boolean' ? raw.exportBackground : undefined,
    showGrid: typeof raw.showGrid === 'boolean' ? raw.showGrid : undefined,
    cornerRadius: typeof raw.cornerRadius === 'number' ? raw.cornerRadius : undefined,
  }
}
