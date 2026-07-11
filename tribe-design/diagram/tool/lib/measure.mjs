// Text measurement used to auto-grow a node to fit its label + secondary label.
// Port of website lib/diagram/measure.ts. The original is client-only (canvas 2D
// measureText); in pure Node there is no DOM, so growNodeToFit falls back to the
// node's current size. Kept for API parity — the CLI's sizing comes from
// layout.mjs's char-width estimate instead.

import { NODE_MIN_W, NODE_MIN_H } from './model.mjs'

const PAD_X = 32 // container p-4 left+right (matches DiagramCanvas)
const PAD_Y = 32 // container p-4 top+bottom
const LABEL_FS = 15
const LABEL_LH = 20
const SUB_FS = 12
const SUB_LH = 16
const GAP = 3
const LABEL_FONT = `500 ${LABEL_FS}px "TribeSans", system-ui, sans-serif`
const SUB_FONT = `400 ${SUB_FS}px "TribeSans", system-ui, sans-serif`

let ctx = null
function getCtx() {
  if (ctx) return ctx
  if (typeof document === 'undefined') return null
  ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

// Greedy wrap `text` at `maxW` px in `font`; also returns the widest single word
// (so the node can grow wide enough that no word overflows mid-word).
function wrap(c, text, font, maxW) {
  c.font = font
  const lines = []
  let longestWord = 0
  for (const para of (text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    for (const w of words) longestWord = Math.max(longestWord, c.measureText(w).width)
    if (words.length === 0) {
      lines.push('') // preserve blank lines
      continue
    }
    let line = ''
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w
      if (c.measureText(cand).width > maxW && line) {
        lines.push(line)
        line = w
      } else {
        line = cand
      }
    }
    lines.push(line)
  }
  if (lines.length === 0) lines.push('')
  return { lines, longestWord }
}

// The size a node should be to fit its text: width grows only (never below the
// node's current width) enough that no word overflows; height fits the wrapped
// label + sub-label. Falls back to the node's own size if no DOM is available.
export function growNodeToFit(node) {
  const c = getCtx()
  if (!c) return { w: node.w, h: node.h }

  const sub = node.subLabel?.trim() ?? ''
  const lWord = wrap(c, node.label ?? '', LABEL_FONT, node.w - PAD_X).longestWord
  const sWord = sub ? wrap(c, sub, SUB_FONT, node.w - PAD_X).longestWord : 0
  const w = Math.max(NODE_MIN_W, node.w, Math.ceil(Math.max(lWord, sWord)) + PAD_X + 4)

  const lLines = wrap(c, node.label ?? '', LABEL_FONT, w - PAD_X).lines.length
  const sLines = sub ? wrap(c, sub, SUB_FONT, w - PAD_X).lines.length : 0
  let h = PAD_Y + lLines * LABEL_LH + (sub ? GAP + sLines * SUB_LH : 0)
  h = Math.max(NODE_MIN_H, Math.ceil(h))
  return { w, h }
}

// Resize a node to fit an updated label / sub-label. Only ever grows.
export function fitNodeToText(node, patch) {
  if (node.image && node.imageMode === 'cover') return { w: node.w, h: node.h }

  const textFit = growNodeToFit({ ...node, ...patch, image: undefined })
  if (!node.image) return { w: textFit.w, h: Math.max(node.h, textFit.h) }

  // Block image: node.h currently = text region + image area. Recover the image
  // area from the node's current geometry and keep it.
  const oldTextH = growNodeToFit({ ...node, image: undefined }).h
  const imageArea = Math.max(0, node.h - oldTextH)
  return { w: textFit.w, h: Math.max(node.h, Math.round(textFit.h + imageArea)) }
}
