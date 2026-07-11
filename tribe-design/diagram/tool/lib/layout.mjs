// Deterministic auto-layout for generated diagrams. The LLM is good at deciding
// the nodes, edges, shapes and colours but poor at pixel positioning (crowding,
// overlaps). So we ignore its coordinates and lay the graph out ourselves:
//   1. size every node to fit its label (+ sub-label)
//   2. rank nodes into layers by longest path (cycles broken safely)
//   3. order within layers to reduce crossings (barycenter sweeps)
//   4. place layers with generous gaps, centring each layer
//   5. pick left-to-right vs top-to-bottom by whichever fills a landscape frame
// Runs without a DOM, so text sizing is a char-width estimate.
// Port of website lib/diagram/layout.ts.

import { NODE_MIN_W, NODE_MIN_H, CANVAS_W, CANVAS_H } from './model.mjs'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── node sizing (estimate; mirrors the on-screen padding/line heights) ──
const PAD_X = 28
const PAD_Y = 18
const LINE_H = 20
const SUB_LINE_H = 16
const GAP = 3
const CHAR_W = 8.2
const SUB_CHAR_W = 6.6
const MAX_W = 260

function longestWord(text) {
  return text.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0)
}

function lineCount(text, maxChars) {
  let lines = 0
  for (const para of (text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines++
      continue
    }
    let n = 1
    let len = 0
    for (const w of words) {
      if (len && len + 1 + w.length > maxChars) {
        n++
        len = w.length
      } else {
        len = len ? len + 1 + w.length : w.length
      }
    }
    lines += n
  }
  return Math.max(1, lines)
}

function sizeForLabel(label, sub) {
  const text = label || ''
  // Aim for a squarish word block, but always wide enough for the longest word.
  const desiredChars = Math.min(26, Math.max(longestWord(text), Math.round(Math.sqrt(text.length) * 3.2), 6))
  const w = clamp(desiredChars * CHAR_W + PAD_X, NODE_MIN_W, MAX_W)
  const lines = lineCount(text, Math.max(4, Math.floor((w - PAD_X) / CHAR_W)))
  const subLines = sub?.trim() ? lineCount(sub, Math.max(4, Math.floor((w - PAD_X) / SUB_CHAR_W))) : 0
  const h = PAD_Y + lines * LINE_H + (subLines ? GAP + subLines * SUB_LINE_H : 0)
  return { w: Math.round(w), h: Math.max(NODE_MIN_H, Math.round(h)) }
}

// ── ranking (longest path from sources; on-stack guard breaks cycles) ──
function rankNodes(nodes, edges) {
  const preds = new Map()
  for (const n of nodes) preds.set(n.id, [])
  for (const e of edges) if (preds.has(e.to) && preds.has(e.from)) preds.get(e.to).push(e.from)
  const rank = new Map()
  const onStack = new Set()
  const visit = (id) => {
    const cached = rank.get(id)
    if (cached !== undefined) return cached
    if (onStack.has(id)) return 0 // cycle — treat this back-edge as no constraint
    onStack.add(id)
    let r = 0
    for (const p of preds.get(id) ?? []) r = Math.max(r, visit(p) + 1)
    onStack.delete(id)
    rank.set(id, r)
    return r
  }
  for (const n of nodes) visit(n.id)
  return rank
}

// ── within-layer ordering: a few barycenter sweeps over neighbour positions ──
function orderLayers(layers, edges) {
  const neighbors = new Map()
  const add = (a, b) => {
    if (!neighbors.has(a)) neighbors.set(a, [])
    neighbors.get(a).push(b)
  }
  for (const e of edges) {
    add(e.from, e.to)
    add(e.to, e.from)
  }
  const posOf = () => {
    const m = new Map()
    layers.forEach((layer) => layer.forEach((id, i) => m.set(id, i)))
    return m
  }
  for (let sweep = 0; sweep < 4; sweep++) {
    const pos = posOf()
    for (const layer of layers) {
      const bary = new Map()
      layer.forEach((id, i) => {
        const ns = neighbors.get(id) ?? []
        const vals = ns.map((n) => pos.get(n)).filter((v) => v !== undefined)
        bary.set(id, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : i)
      })
      layer.sort((a, b) => bary.get(a) - bary.get(b))
    }
  }
}

// Place ranked layers along a main axis; returns positions + overall size.
// `labelW` is the widest edge-label chip; layer gaps grow to keep labels off the
// neighbouring nodes.
function place(sized, layers, orientation, labelW) {
  const hasLabels = labelW > 0
  const GAP_MAIN = orientation === 'LR'
    ? Math.max(96, labelW + 40) // between layers — must clear the label chip
    : (hasLabels ? 116 : 72)
  const GAP_CROSS = hasLabels ? 64 : 44 // between nodes in a layer
  const mainSize = (id) => (orientation === 'LR' ? sized.get(id).w : sized.get(id).h)
  const crossSize = (id) => (orientation === 'LR' ? sized.get(id).h : sized.get(id).w)

  const layerMain = layers.map((l) => Math.max(...l.map(mainSize), 1))
  const layerCross = layers.map((l) => l.reduce((s, id) => s + crossSize(id), 0) + GAP_CROSS * Math.max(0, l.length - 1))
  const maxCross = Math.max(...layerCross, 1)

  const pos = new Map()
  let mainCursor = 0
  layers.forEach((layer, i) => {
    let cross = (maxCross - layerCross[i]) / 2
    for (const id of layer) {
      const mainOff = (layerMain[i] - mainSize(id)) / 2
      if (orientation === 'LR') pos.set(id, { x: mainCursor + mainOff, y: cross })
      else pos.set(id, { x: cross, y: mainCursor + mainOff })
      cross += crossSize(id) + GAP_CROSS
    }
    mainCursor += layerMain[i] + GAP_MAIN
  })
  const totalMain = mainCursor - GAP_MAIN
  return orientation === 'LR' ? { pos, w: totalMain, h: maxCross } : { pos, w: maxCross, h: totalMain }
}

const TARGET_ASPECT = 1.5 // prefer a gently-landscape frame
const MARGIN = 60

// Re-layout a diagram: keep labels/shapes/colours/edges, replace geometry.
export function autoLayout(diagram) {
  const nodes = diagram.nodes.filter((n) => n.kind !== 'badge')
  if (nodes.length === 0) return diagram

  const sized = new Map()
  // Nodes with an image keep their current size — only text-only nodes are
  // re-sized to fit their label.
  for (const n of nodes) sized.set(n.id, n.image ? { w: n.w, h: n.h } : sizeForLabel(n.label, n.subLabel))

  const rank = rankNodes(nodes, diagram.edges)
  const maxRank = Math.max(...nodes.map((n) => rank.get(n.id) ?? 0))

  // Flip the layering if the flow runs against increasing rank, so the dominant
  // flow reads top→bottom / left→right.
  let forward = 0
  let backward = 0
  for (const e of diagram.edges) {
    const rf = rank.get(e.from)
    const rt = rank.get(e.to)
    if (rf === undefined || rt === undefined || rf === rt) continue
    if (rt > rf) forward++
    else backward++
  }
  if (backward > forward) for (const n of nodes) rank.set(n.id, maxRank - (rank.get(n.id) ?? 0))

  const layers = Array.from({ length: maxRank + 1 }, () => [])
  for (const n of nodes) layers[rank.get(n.id) ?? 0].push(n.id)
  orderLayers(layers, diagram.edges)

  // Widest edge-label chip (chars × 6.5 + 24), so the placement can open enough
  // room between layers for labels to read cleanly.
  const labelW = diagram.edges.reduce(
    (m, e) => (e.label?.trim() ? Math.max(m, Math.round(e.label.trim().length * 6.5 + 24)) : m),
    0,
  )

  // Try both orientations; pick the one whose aspect is closest to landscape.
  const lr = place(sized, layers, 'LR', labelW)
  const tb = place(sized, layers, 'TB', labelW)
  const score = (r) => Math.abs(Math.log(r.w / r.h / TARGET_ASPECT))
  const chosen = score(lr) <= score(tb) ? lr : tb

  // Center the whole layout within the canvas, never tighter than the margin.
  const offX = Math.max(MARGIN, Math.round((CANVAS_W - chosen.w) / 2))
  const offY = Math.max(MARGIN, Math.round((CANVAS_H - chosen.h) / 2))
  const laidOut = diagram.nodes.map((n) => {
    const s = sized.get(n.id)
    const p = chosen.pos.get(n.id)
    if (!s || !p) return n // badges / unknowns untouched
    return { ...n, x: Math.round(p.x + offX), y: Math.round(p.y + offY), w: s.w, h: s.h }
  })
  // A full re-layout moves every node, so any manual routing waypoints (absolute
  // canvas coords) no longer make sense — drop them and let edges auto-route.
  const edges = diagram.edges.map((e) => (e.waypoints ? { ...e, waypoints: undefined } : e))
  return { ...diagram, nodes: laidOut, edges }
}
