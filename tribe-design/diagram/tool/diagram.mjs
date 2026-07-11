#!/usr/bin/env node
/**
 * Tribe Design — diagram renderer.
 * Turns a diagram JSON (nodes + edges, coordinates optional) into a finished
 * Tribe-branded SVG (and optionally a PNG via headless Chromium).
 *
 * Usage:
 *   node diagram.mjs <input.json> [--out out.svg] [--png out.png] [--scale 2]
 *
 *   <input.json>   {title?, nodes[], edges[], background?, exportBackground?, cornerRadius?}
 *   --out <file>   SVG output path (default: <input>.svg next to the input)
 *   --png <file>   also rasterise to PNG (spawns ../../scripts/render.mjs)
 *   --scale <n>    PNG device scale factor (default 2)
 *
 * Pipeline: read JSON → sanitizeDiagram → autoLayout → diagramToSvg → write.
 * Layout: if EVERY node in the input already carries numeric x/y (badges
 * snapped to a parent via parentId+anchor are exempt), the positions are
 * respected and autoLayout is skipped. Otherwise the layout engine ignores any
 * coordinates and lays the whole graph out itself (the site does the same for
 * AI-generated diagrams — see app/handbook/diagram/api/generate/route.ts).
 *
 * See NOTES.md for the full JSON schema and authoring guidance.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import { sanitizeDiagram } from './lib/model.mjs'
import { autoLayout } from './lib/layout.mjs'
import { diagramToSvg, exportBounds } from './lib/svg.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RENDER = path.join(__dirname, '../../scripts/render.mjs')

// ── args ──
const argv = process.argv.slice(2)
const args = { _: [] }
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) args[key] = true
    else { args[key] = next; i++ }
  } else {
    args._.push(argv[i])
  }
}

const inputPath = args._[0]
if (!inputPath) {
  console.error('Usage: node diagram.mjs <input.json> [--out out.svg] [--png out.png] [--scale 2]')
  process.exit(1)
}

// ── read + sanitize ──
let parsed
try {
  parsed = JSON.parse(readFileSync(path.resolve(inputPath), 'utf8'))
} catch (err) {
  console.error(`Could not read/parse ${inputPath}: ${err.message}`)
  process.exit(1)
}

const clean = sanitizeDiagram(parsed)
if (clean.nodes.length === 0) {
  console.error('No usable nodes in the input (each node needs at least a string "id").')
  process.exit(1)
}

// Respect manual positions only when the WHOLE diagram is manually placed:
// every node in the raw input carries numeric x AND y (a badge snapped to a
// parent via parentId+anchor is positioned by the parent, so it's exempt).
// Any node missing coordinates → full auto-layout, same as the site.
const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
const isSnappedBadge = (n) => n?.kind === 'badge' && typeof n.parentId === 'string' && n.anchor
const manualLayout =
  rawNodes.length > 0 &&
  rawNodes.every((n) => isSnappedBadge(n) || (Number.isFinite(n?.x) && Number.isFinite(n?.y)))

const diagram = manualLayout ? clean : autoLayout(clean)

// ── SVG ──
const svg = diagramToSvg(diagram)
const outSvg = path.resolve(typeof args.out === 'string' ? args.out : inputPath.replace(/\.json$/i, '') + '.svg')
writeFileSync(outSvg, svg)
const b = exportBounds(diagram)
console.log(`Wrote ${outSvg} (${Math.round(b.w)}×${Math.round(b.h)}, layout: ${manualLayout ? 'manual' : 'auto'})`)

// ── PNG (optional) — rasterise the SVG in headless Chromium via render.mjs ──
if (typeof args.png === 'string') {
  const scale = Number(args.scale || 2)
  const outPng = path.resolve(args.png)
  // The export SVG is transparent unless exportBackground bakes a colour in;
  // omit the page background so a transparent SVG stays transparent as a PNG.
  const transparent = !diagram.exportBackground
  const tmp = mkdtempSync(path.join(tmpdir(), 'tribe-diagram-'))
  try {
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`
    const htmlPath = path.join(tmp, 'diagram.html')
    writeFileSync(htmlPath, html)
    const cmd = [
      RENDER,
      '--html', htmlPath,
      '--selector', 'svg',
      '--out', outPng,
      '--scale', String(scale),
      '--width', String(Math.ceil(b.w)),
      '--height', String(Math.ceil(b.h)),
      ...(transparent ? ['--transparent'] : []),
    ]
    const res = spawnSync(process.execPath, cmd, { stdio: 'inherit' })
    if (res.status !== 0) {
      console.error('PNG render failed (see errors above). The SVG was still written.')
      process.exit(res.status ?? 1)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
