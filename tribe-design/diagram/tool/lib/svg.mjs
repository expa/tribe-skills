// Serialises a Diagram to a standalone SVG string — used for the SVG export and
// (rasterised in headless Chromium) the PNG export. Port of website
// lib/diagram/svg.ts (the browser-only diagramToPngDataUrl is omitted; the CLI
// rasterises via scripts/render.mjs instead).

import {
  NODE_COLORS,
  NODE_STROKE_W,
  EDGE_STROKE,
  EDGE_WIDTH,
  EDGE_WIDTH_BOLD,
  EDGE_LABEL_BG,
  EDGE_LABEL_TEXT,
  CANVAS_BG,
  edgeStrokeColor,
  withBadgePositions,
} from './model.mjs'
import { routeEdges, edgePath } from './route.mjs'
import { markerDefs, markerRef } from './markers.mjs'

// Caption idiom for arrow labels: uppercase + tracking (matches the site).
const CAPTION_FONT = 'ui-sans-serif, system-ui, sans-serif'

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const FONT_SIZE = 15
const LINE_H = 19
const SUB_FONT_SIZE = 12
const SUB_LINE_H = 16
const SUB_GAP = 3
const PAD = 48 // export margin around content

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Word-wrap to fit `maxWidth`, honoring explicit line breaks, capped at maxLines.
function wrapLabel(label, maxWidth, maxLines = 8) {
  const charW = FONT_SIZE * 0.56
  const perLine = Math.max(4, Math.floor(maxWidth / charW))
  const lines = []
  for (const para of (label ?? '').split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length > perLine && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  if (lines.length === 0) lines.push('')
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, '') + '…'
  }
  return lines
}

function badgeSvg(n) {
  const c = NODE_COLORS[n.color]
  const cx = n.x + n.w / 2
  const cy = n.y + n.h / 2
  return (
    `<circle cx="${cx}" cy="${cy}" r="${n.w / 2 - 1}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${NODE_STROKE_W}"/>` +
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="16" font-weight="600" fill="${c.text}">${esc(n.label)}</text>`
  )
}

// Cover image: clipped to the node shape, edge-to-edge, no text.
function coverImageSvg(n) {
  const clip = `dgclip-${n.id}`
  return (
    `<clipPath id="${clip}">${nodeShapeSvg(n)}</clipPath>` +
    `<image href="${n.image}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
  )
}

// Block image: label at the top, image below it with a margin + rounded corners.
function blockImageSvg(n) {
  const c = NODE_COLORS[n.color]
  const align = n.textAlign ?? 'center'
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
  const labelX = align === 'left' ? n.x + TEXT_PAD : align === 'right' ? n.x + n.w - TEXT_PAD : n.x + n.w / 2
  const subX = labelX
  const lines = wrapLabel(n.label, n.w - TEXT_PAD * 2)
  const sub = n.subLabel?.trim() ? wrapLabel(n.subLabel, n.w - TEXT_PAD * 2, 2) : []
  let y = n.y + TEXT_PAD + LINE_H / 2
  const labelSpans = lines.map((ln) => { const s = `<tspan x="${labelX}" y="${y}">${esc(ln)}</tspan>`; y += LINE_H; return s }).join('')
  let text = `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${FONT}" font-size="${FONT_SIZE}" font-weight="500" fill="${c.text}">${labelSpans}</text>`
  if (sub.length) {
    y += SUB_GAP - LINE_H + SUB_LINE_H
    const subSpans = sub.map((ln) => { const s = `<tspan x="${subX}" y="${y}">${esc(ln)}</tspan>`; y += SUB_LINE_H; return s }).join('')
    text += `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${FONT}" font-size="${SUB_FONT_SIZE}" font-weight="400" fill="${c.text}" fill-opacity="0.65">${subSpans}</text>`
  }
  const M = 8
  const iy = Math.round(y + LINE_H / 2 + 2)
  const iw = n.w - M * 2
  const ih = n.y + n.h - M - iy
  let img = ''
  if (ih > 6 && iw > 6) {
    const clip = `dgclip-${n.id}`
    img =
      `<clipPath id="${clip}"><rect x="${n.x + M}" y="${iy}" width="${iw}" height="${ih}" rx="8"/></clipPath>` +
      `<image href="${n.image}" x="${n.x + M}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
  }
  return nodeShapeSvg(n) + text + img
}

function nodeSvg(n) {
  if (n.image && n.imageMode === 'cover') return nodeShapeSvg(n) + coverImageSvg(n)
  if (n.image) return blockImageSvg(n)
  return nodeShapeSvg(n) + nodeTextSvg(n)
}

function nodeShapeSvg(n) {
  const c = NODE_COLORS[n.color]
  const common = `fill="${c.fill}" stroke="${c.stroke}" stroke-width="${NODE_STROKE_W}"`
  switch (n.shape) {
    case 'rect':
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" ${common}/>`
    case 'pill':
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" ${common}/>`
    case 'ellipse':
      return `<ellipse cx="${n.x + n.w / 2}" cy="${n.y + n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" ${common}/>`
    case 'diamond': {
      const cx = n.x + n.w / 2
      const cy = n.y + n.h / 2
      const pts = `${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`
      return `<polygon points="${pts}" ${common}/>`
    }
    case 'rounded':
    default:
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" ${common}/>`
  }
}

// Uniform text padding inside a node — same value on all sides, for both the
// label and the sub-label.
const TEXT_PAD = 16

function nodeTextSvg(n) {
  const c = NODE_COLORS[n.color]
  const align = n.textAlign ?? 'center'
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
  const labelX = align === 'left' ? n.x + TEXT_PAD : align === 'right' ? n.x + n.w - TEXT_PAD : n.x + n.w / 2
  const subX = labelX
  const lines = wrapLabel(n.label, n.w - TEXT_PAD * 2)
  const sub = n.subLabel?.trim() ? wrapLabel(n.subLabel, n.w - TEXT_PAD * 2, 3) : []
  const cy = n.y + n.h / 2
  // Centre the whole label + sub-label block vertically.
  const blockH = lines.length * LINE_H + (sub.length ? SUB_GAP + sub.length * SUB_LINE_H : 0)
  let y = cy - blockH / 2 + LINE_H / 2
  const labelSpans = lines
    .map((ln) => {
      const span = `<tspan x="${labelX}" y="${y}">${esc(ln)}</tspan>`
      y += LINE_H
      return span
    })
    .join('')
  const label = `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${FONT}" font-size="${FONT_SIZE}" font-weight="500" fill="${c.text}">${labelSpans}</text>`
  if (!sub.length) return label
  y += SUB_GAP - LINE_H + SUB_LINE_H
  const subSpans = sub
    .map((ln) => {
      const span = `<tspan x="${subX}" y="${y}">${esc(ln)}</tspan>`
      y += SUB_LINE_H
      return span
    })
    .join('')
  const subText = `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${FONT}" font-size="${SUB_FONT_SIZE}" font-weight="400" fill="${c.text}" fill-opacity="0.65">${subSpans}</text>`
  return label + subText
}

function edgeSvg(re, edge, radius) {
  const d = edgePath(re.points, radius)
  const dash = re.dashed ? ' stroke-dasharray="6 5"' : ''
  const stroke = edgeStrokeColor(edge.color)
  const ms = markerRef(edge.startCap, 'none', stroke)
  const me = markerRef(edge.endCap, 'triangle', stroke)
  const caps = (ms ? ` marker-start="${ms}"` : '') + (me ? ` marker-end="${me}"` : '')
  const width = edge.bold ? EDGE_WIDTH_BOLD : EDGE_WIDTH
  const line = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash}${caps}/>`
  if (!re.label) return line
  const text = re.label.toUpperCase()
  const w = Math.max(28, text.length * 7.2 + 24)
  const { x: mx, y: my } = re.labelPos
  const pal = edge.labelColor ? NODE_COLORS[edge.labelColor] : null
  const fill = pal ? pal.fill : EDGE_LABEL_BG
  const txt = pal ? pal.text : EDGE_LABEL_TEXT
  const border = edge.labelBorder ? ` stroke="${pal ? pal.stroke : EDGE_STROKE}" stroke-width="1"` : ''
  const label =
    `<rect x="${mx - w / 2}" y="${my - 11}" width="${w}" height="22" rx="4" fill="${fill}"${border}/>` +
    `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-family="${CAPTION_FONT}" font-size="10" letter-spacing="1" fill="${txt}">${esc(text)}</text>`
  return line + label
}

// Bounding box of all node geometry, padded — the export viewport.
function contentBounds(diagram) {
  if (diagram.nodes.length === 0) return { x: 0, y: 0, w: 400, h: 300 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of diagram.nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  return {
    x: minX - PAD,
    y: minY - PAD,
    w: maxX - minX + PAD * 2,
    h: maxY - minY + PAD * 2,
  }
}

// The rectangle an export will occupy (content bounding box + margin), in world
// coords.
export function exportBounds(diagram) {
  return contentBounds(withBadgePositions(diagram))
}

export function diagramToSvg(diagram, opts) {
  const d = withBadgePositions(diagram)
  const b = contentBounds(d)
  // Explicit override wins; otherwise the background is only baked in when the
  // "show in export" flag is set — else the export is transparent.
  const bg = opts?.background ?? (diagram.exportBackground ? diagram.background ?? CANVAS_BG : 'transparent')
  const radius = diagram.cornerRadius ?? 0
  const byId = new Map(d.edges.map((e) => [e.id, e]))
  const defs = `<defs>${markerDefs()}</defs>`
  const edges = routeEdges(d)
    .map((re) => edgeSvg(re, byId.get(re.id), radius))
    .join('')
  const nodes = d.nodes.map((n) => (n.kind === 'badge' ? badgeSvg(n) : nodeSvg(n))).join('')
  const bgRect = bg === 'transparent' ? '' : `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${bg}"/>`
  // Nodes first, then edges — so arrow caps sit ABOVE the nodes they touch.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(b.h)}" ` +
    `viewBox="${b.x} ${b.y} ${b.w} ${b.h}">${defs}${bgRect}${nodes}${edges}</svg>`
  )
}
