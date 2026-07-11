'use client'

// Data-card studio. Turns pasted numbers into a clean, on-brand bar or line chart
// — brand palette, Tribe type, minimal axes (no gridline clutter or Excel look).
// Paste "Label, Value" per line. Multiple comma-separated values per line become
// grouped bars / multiple lines; a "(Custom)" suffix overrides the value label.
// Canvas-rendered in the Tribe fonts; exports 2× PNG.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GeneratorShell } from '../../components/generators/GeneratorShell'
import { Field, TextInput, Textarea, SegmentedControl, Toggle } from '../../components/generators/ui'
import { ExportMenu } from '../../components/generators/ExportMenu'
import { downloadBlob } from '../../components/generators/download'
import { colors } from '@/lib/colors'

type Format = '1:1' | '16:9' | '4:5'
type Chart = 'bar' | 'line'
type Logo = 'none' | 'wordmark' | 'symbol'
const EXPORT_SCALE = 2
// Preview shows at half the card size — never an upscale (export renders separately).
const PREVIEW_SCALE = 0.5

const DIMS: Record<Format, [number, number]> = {
  '1:1': [1080, 1080],
  '16:9': [1600, 900],
  '4:5': [1080, 1350],
}
const FORMAT_OPTS = [
  { id: '1:1' as Format, label: 'Square' },
  { id: '16:9' as Format, label: 'Landscape' },
  { id: '4:5' as Format, label: 'Portrait' },
]
const CHART_OPTS = [
  { id: 'bar' as Chart, label: 'Bar' },
  { id: 'line' as Chart, label: 'Line' },
]

const SURFACES = [
  { id: 'paper', name: 'Paper', color: colors.backgroundPrimary },
  { id: 'sand', name: 'Sand', color: colors.backgroundSecondary },
  { id: 'ink', name: 'Ink', color: colors.foregroundPrimary },
  { id: 'ocean', name: 'Ocean', color: colors.accentOcean },
  { id: 'teal', name: 'Teal', color: colors.accentTeal },
  { id: 'brand', name: 'Cyan', color: colors.brand },
  { id: 'brown', name: 'Brown', color: colors.accentBrown },
  { id: 'orange', name: 'Orange', color: colors.accentOrange },
  { id: 'yellow', name: 'Yellow', color: colors.accentYellow },
] as const
type SurfaceId = (typeof SURFACES)[number]['id']

type Accent = 'teal' | 'orange' | 'brown' | 'yellow' | 'ocean' | 'brand'
const ACCENTS: Record<Accent, string> = {
  teal: colors.accentTeal,
  orange: colors.accentOrange,
  brown: colors.accentBrown,
  yellow: colors.accentYellow,
  ocean: colors.accentOcean,
  brand: colors.brand,
}
const ACCENT_SWATCHES: { id: Accent; name: string; color: string }[] = [
  { id: 'teal', name: 'Teal', color: colors.accentTeal },
  { id: 'orange', name: 'Orange', color: colors.accentOrange },
  { id: 'brown', name: 'Brown', color: colors.accentBrown },
  { id: 'yellow', name: 'Yellow', color: colors.accentYellow },
  { id: 'ocean', name: 'Ocean', color: colors.accentOcean },
  { id: 'brand', name: 'Cyan', color: colors.brand },
]
const SERIES_ORDER: Accent[] = ['teal', 'orange', 'brown', 'yellow', 'ocean', 'brand']
// Colors for multi-series data: the chosen accent first, then the rest in order.
function seriesColors(primary: Accent, n: number): string[] {
  const order = [primary, ...SERIES_ORDER.filter((a) => a !== primary)]
  return Array.from({ length: n }, (_, i) => ACCENTS[order[i % order.length]])
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255) < 0.5
}

// Greedy word-wrap at maxWidth in the ctx's current font; respects hard \n breaks.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(''); continue }
    let line = ''
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word
      if (ctx.measureText(cand).width > maxWidth && line) { out.push(line); line = word }
      else line = cand
    }
    out.push(line)
  }
  return out
}

// One data value: its numeric magnitude + the string to print near the mark. The
// printed string is a "(custom)" label when present, else the raw value token
// (so "42%" or "$3.2M" render as typed).
type Value = { value: number; display: string }
type Point = { label: string; values: Value[] }

// Parse a single value token like "12", "$3.2M", or "10 (Great)".
function parseValue(token: string): Value | null {
  const s = token.trim()
  if (!s) return null
  const pm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  const numPart = (pm ? pm[1] : s).trim()
  const custom = pm ? pm[2].trim() : ''
  const value = parseFloat(numPart.replace(/[^0-9.-]/g, ''))
  if (Number.isNaN(value)) return null
  return { value, display: custom || numPart }
}

// Parse "Label, Value[, Value…]" lines into points. The label may contain spaces;
// the first value can follow the label with a comma/tab OR a space. Extra values
// are comma-separated. A trailing "(Custom)" on any value overrides its printed label.
//   "Q1, 12"            → Q1: [12]
//   "Q1 10, 20"         → Q1: [10, 20]
//   "Q1 10 (Great)"     → Q1: [10 shown as "Great"]
function parseData(text: string): { points: Point[]; seriesCount: number } {
  const points: Point[] = []
  const numRe = /^([-+]?[$€£]?\d[\d.]*[%×xKMBkmb]*(?:\s*\([^)]*\))?)$/
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/\s*[,\t]\s*/)
    let label = ''
    const values: Value[] = []
    // First segment may be "Label" or "Label value" (space-separated).
    const first = parts[0]
    const spaceSplit = first.match(/^(.*?)\s+(\S.*)$/)
    if (spaceSplit && numRe.test(spaceSplit[2].trim())) {
      label = spaceSplit[1].trim()
      const v = parseValue(spaceSplit[2])
      if (v) values.push(v)
    } else {
      label = first.trim()
    }
    for (const seg of parts.slice(1)) {
      const v = parseValue(seg)
      if (v) values.push(v)
    }
    if (!label || !values.length) continue
    points.push({ label, values })
  }
  const seriesCount = points.reduce((m, p) => Math.max(m, p.values.length), 0)
  return { points, seriesCount }
}

function SwatchPicker<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { id: T; name: string; color: string }[]
  onChange: (v: T) => void
}) {
  const current = options.find((o) => o.id === value)
  return (
    <Field label={`${label} (${current?.name ?? ''})`}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.name}
            aria-pressed={o.id === value}
            onClick={() => onChange(o.id)}
            className={`h-7 w-7 rounded-md border transition-colors ${
              o.id === value
                ? 'border-transparent ring-2 ring-brand ring-offset-2 ring-offset-background-primary'
                : 'border-foreground-primary/15 hover:border-foreground-primary/40'
            }`}
            style={{ background: o.color }}
          />
        ))}
      </div>
    </Field>
  )
}

export default function DataCardStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<() => void>(() => undefined)
  const [fontsReady, setFontsReady] = useState(false)
  const markDark = useRef<HTMLImageElement | null>(null)
  const markLight = useRef<HTMLImageElement | null>(null)
  const symDark = useRef<HTMLImageElement | null>(null)
  const symLight = useRef<HTMLImageElement | null>(null)

  const [format, setFormat] = useState<Format>('16:9')
  const [chart, setChart] = useState<Chart>('bar')
  const [surface, setSurface] = useState<SurfaceId>('paper')
  const [accent, setAccent] = useState<Accent>('teal')
  const [logo, setLogo] = useState<Logo>('wordmark')
  const [showValues, setShowValues] = useState(true)
  const [eyebrow, setEyebrow] = useState('By the numbers')
  const [title, setTitle] = useState('Time to production, by engagement')
  const [helper, setHelper] = useState('Source: Analytics')
  const [data, setData] = useState('Q1, 12\nQ2, 19\nQ3, 27\nQ4, 41')

  useEffect(() => {
    let alive = true
    Promise.all([
      document.fonts.load('300 60px TribeSerif'),
      document.fonts.load('400 24px TribeCaption'),
      document.fonts.load('400 24px TribeSans'),
    ]).then(() => document.fonts.ready).then(() => { if (alive) setFontsReady(true) }).catch(() => { if (alive) setFontsReady(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const load = (src: string, ref: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new Image()
      img.onload = () => { ref.current = img; drawRef.current() }
      img.src = src
    }
    load('/brand/wordmark.svg', markDark)
    load('/brand/wordmark-inverted.svg', markLight)
    load('/brand/symbol.svg', symDark)
    load('/brand/symbol-inverted.svg', symLight)
  }, [])

  const paint = useCallback((ctx: CanvasRenderingContext2D) => {
    const [W, H] = DIMS[format]
    const surf = SURFACES.find((s) => s.id === surface) ?? SURFACES[0]
    const bg = surf.color
    const dark = isDarkColor(bg)
    const ink = dark ? colors.backgroundPrimary : colors.foregroundPrimary
    const acc = ACCENTS[accent]
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const M = Math.round(W * 0.07)
    const cw = W - M * 2
    const { points, seriesCount } = parseData(data)
    const palette = seriesColors(accent, Math.max(1, seriesCount))

    // Header: eyebrow + title, top-left. (Eyebrow matches the social-card treatment.)
    let headerBottom = M
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    if (eyebrow.trim()) {
      // Landscape is much wider, so scale the eyebrow down there to keep it in proportion.
      const size = Math.round(W * (format === '16:9' ? 0.019 : 0.026))
      ctx.font = `400 ${size}px TribeCaption`
      ctx.fillStyle = ink
      ctx.letterSpacing = `${Math.max(1, size * 0.09)}px`
      ctx.fillText(eyebrow.trim().toUpperCase(), M, headerBottom)
      ctx.letterSpacing = '0px'
      headerBottom += size * 1.7
    }
    if (title.trim()) {
      const size = Math.round(W * 0.038)
      ctx.font = `300 ${size}px TribeSerif`
      ctx.fillStyle = ink
      const lines = wrapText(ctx, title.trim(), cw)
      const lh = size * 1.25
      lines.forEach((line) => { ctx.fillText(line, M, headerBottom); headerBottom += lh })
    }

    // Bottom row: wordmark/symbol (left) + helper text (right), on the same baseline.
    const logoH = logo === 'symbol' ? H * 0.055 : H * 0.035
    const helperSize = Math.round(W * 0.018)
    const hasBottom = logo !== 'none' || !!helper.trim()
    const bottomH = logo !== 'none' ? logoH : (helper.trim() ? helperSize : 0)
    // Plot area, generously spaced from the header above and the footer below.
    const labelBand = H * 0.05 // room for x labels
    const plotTop = headerBottom + H * 0.08
    const plotBottom = (H - M - bottomH) - (hasBottom ? H * 0.06 : H * 0.03) - labelBand
    const plotLeft = M
    const plotRight = W - M
    const plotW = plotRight - plotLeft
    const plotH = Math.max(10, plotBottom - plotTop)
    const maxV = Math.max(1, ...points.flatMap((p) => p.values.map((v) => v.value)))

    const labelSize = Math.round(W * 0.016)
    const valueSize = Math.round(W * 0.018)

    // Baseline hairline.
    ctx.strokeStyle = withAlpha(ink, 0.15)
    ctx.lineWidth = Math.max(1, W * 0.0015)
    ctx.beginPath(); ctx.moveTo(plotLeft, plotBottom); ctx.lineTo(plotRight, plotBottom); ctx.stroke()

    if (points.length) {
      if (chart === 'bar') {
        const slot = plotW / points.length
        const groupW = Math.min(slot * 0.7, W * 0.14 * Math.max(1, seriesCount))
        const innerGap = seriesCount > 1 ? groupW * 0.08 : 0
        const bw = (groupW - innerGap * (seriesCount - 1)) / Math.max(1, seriesCount)
        points.forEach((p, i) => {
          const cx = plotLeft + slot * (i + 0.5)
          const gx = cx - groupW / 2
          p.values.forEach((val, j) => {
            const bh = (val.value / maxV) * plotH
            const x = gx + j * (bw + innerGap)
            const y = plotBottom - bh
            ctx.fillStyle = palette[j]
            ctx.fillRect(x, y, bw, bh)
            if (showValues) {
              ctx.fillStyle = ink
              ctx.font = `400 ${valueSize}px TribeCaption`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'bottom'
              ctx.fillText(val.display, x + bw / 2, y - H * 0.012)
            }
          })
          ctx.fillStyle = withAlpha(ink, 0.6)
          ctx.font = `400 ${labelSize}px TribeCaption`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(p.label.toUpperCase(), cx, plotBottom + H * 0.015)
        })
      } else {
        const stepX = points.length > 1 ? plotW / (points.length - 1) : 0
        const px = (i: number) => plotLeft + (points.length > 1 ? stepX * i : plotW / 2)
        const py = (v: number) => plotBottom - (v / maxV) * plotH
        // One line per series.
        for (let j = 0; j < seriesCount; j++) {
          ctx.strokeStyle = palette[j]
          ctx.lineWidth = Math.max(2, W * 0.004)
          ctx.lineJoin = 'round'
          ctx.beginPath()
          let started = false
          points.forEach((p, i) => {
            const val = p.values[j]
            if (!val) { started = false; return }
            const x = px(i), y = py(val.value)
            if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
          })
          ctx.stroke()
          // Dots + value labels.
          points.forEach((p, i) => {
            const val = p.values[j]
            if (!val) return
            const x = px(i), y = py(val.value)
            ctx.fillStyle = palette[j]
            ctx.beginPath(); ctx.arc(x, y, Math.max(3, W * 0.006), 0, Math.PI * 2); ctx.fill()
            if (showValues) {
              ctx.fillStyle = ink
              ctx.font = `400 ${valueSize}px TribeCaption`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'bottom'
              ctx.fillText(val.display, x, y - H * 0.018)
            }
          })
        }
        // X labels (once per point).
        ctx.fillStyle = withAlpha(ink, 0.6)
        ctx.font = `400 ${labelSize}px TribeCaption`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        points.forEach((p, i) => ctx.fillText(p.label.toUpperCase(), px(i), plotBottom + H * 0.015))
      }
    }

    // Wordmark or symbol, bottom-left. Dark surface → light mark.
    if (logo !== 'none') {
      const mark = logo === 'wordmark'
        ? (dark ? markLight.current : markDark.current)
        : (dark ? symLight.current : symDark.current)
      if (mark && mark.naturalWidth) {
        const w = (mark.naturalWidth / mark.naturalHeight) * logoH
        ctx.drawImage(mark, M, H - M - logoH, w, logoH)
      }
    }

    // Helper text, bottom-right — extra-small body, tertiary ink, aligned with the logo row.
    if (helper.trim()) {
      ctx.font = `400 ${helperSize}px TribeSans`
      ctx.fillStyle = withAlpha(ink, 0.5)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const cy = logo !== 'none' ? H - M - logoH / 2 : H - M - helperSize / 2
      ctx.fillText(helper.trim(), W - M, cy)
    }

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing = '0px'
  }, [format, chart, surface, accent, logo, showValues, eyebrow, title, helper, data])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const [W, H] = DIMS[format]
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    paint(ctx)
  }, [paint, format])

  useEffect(() => { drawRef.current = draw }, [draw])
  useEffect(() => { draw() }, [draw, fontsReady])

  const handleExport = (fmt: string) => {
    const [W, H] = DIMS[format]
    const off = document.createElement('canvas')
    off.width = W * EXPORT_SCALE
    off.height = H * EXPORT_SCALE
    const octx = off.getContext('2d')
    if (!octx) return
    octx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0)
    paint(octx)
    const mime = fmt === 'webp' ? 'image/webp' : 'image/png'
    off.toBlob((blob) => { if (blob) downloadBlob(blob, `tribe-data-card-${chart}@2x.${fmt}`) }, mime, fmt === 'webp' ? 0.95 : undefined)
  }

  const [w, h] = DIMS[format]

  return (
    <GeneratorShell
      title="Data Card"
      footer={
        <ExportMenu
          label="Export"
          onExport={handleExport}
          formats={[
            { id: 'png', label: 'PNG image' },
            { id: 'webp', label: 'WEBP image' },
          ]}
        />
      }
      canvas={
        <div className="absolute inset-0 grid place-items-center overflow-hidden bg-background-soft p-6" style={{ containerType: 'size' }}>
          <div
            className="relative overflow-hidden rounded-lg shadow-[0_30px_80px_-30px_rgba(6,20,27,0.35)]"
            style={{
              // Show at half the card size (never upscaled), or smaller to fit the viewport.
              aspectRatio: `${w} / ${h}`,
              width: `min(${Math.round(w * PREVIEW_SCALE)}px, calc(100cqw - 3rem), calc((100cqh - 3rem) * ${w} / ${h}))`,
            }}
          >
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        </div>
      }
    >
      <SegmentedControl label="Format" value={format} options={FORMAT_OPTS} onChange={setFormat} columns={3} />
      <SegmentedControl label="Chart" value={chart} options={CHART_OPTS} onChange={setChart} columns={2} />
      <SwatchPicker
        label="Surface"
        value={surface}
        options={SURFACES.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        onChange={setSurface}
      />
      <SwatchPicker label="Accent" value={accent} options={ACCENT_SWATCHES} onChange={setAccent} />

      <Textarea
        label="Data (label, value per line)"
        value={data}
        onChange={setData}
        rows={6}
        placeholder={'Q1, 12\nQ2 10, 20\nQ3 27 (Great)'}
      />
      <p className="-mt-2 text-[11px] leading-relaxed text-foreground-primary/50">
        One point per line as <span className="text-foreground-primary/70">Label, Value</span>. Add more
        comma-separated numbers for grouped bars / multiple lines (<span className="text-foreground-primary/70">Q1 10, 20</span>).
        Put a label in parentheses to override the printed value (<span className="text-foreground-primary/70">Q1 27 (Great)</span>).
      </p>

      <TextInput label="Eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="Optional kicker" />
      <TextInput label="Title" value={title} onChange={setTitle} placeholder="What the chart shows" />
      <TextInput label="Helper" value={helper} onChange={setHelper} placeholder="e.g. Source: Analytics" />
      <Toggle label="Show values" checked={showValues} onChange={setShowValues} />
      <SegmentedControl
        label="Watermark"
        value={logo}
        options={[
          { id: 'none' as Logo, label: 'None' },
          { id: 'wordmark' as Logo, label: 'Wordmark' },
          { id: 'symbol' as Logo, label: 'Symbol' },
        ]}
        onChange={setLogo}
        columns={3}
      />
    </GeneratorShell>
  )
}
