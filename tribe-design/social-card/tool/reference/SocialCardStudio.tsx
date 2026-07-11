'use client'

// Social / Quote / Stat card studio. Composes on-brand square/portrait/story cards
// for LinkedIn, X and Instagram — the kind of text-forward graphic that's easy to
// get wrong by hand (serif never bold, no orange eyebrows, opacity hierarchy, safe
// margins). Everything is drawn on a <canvas> at the format's native resolution
// using the real Tribe fonts, so the export IS what you see. Three modes:
//   - Quote     → a pulled quote + attribution
//   - Statement → eyebrow + headline + optional supporting line
//   - Stat      → a hero number + label + optional support
// A subtle node-dot motif and the wordmark nod to the brand system.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { GeneratorShell } from '../../components/generators/GeneratorShell'
import { Field, TextInput, Textarea, SegmentedControl, Slider, Toggle, Divider } from '../../components/generators/ui'
import { ExportMenu } from '../../components/generators/ExportMenu'
import { downloadBlob } from '../../components/generators/download'
import { colors } from '@/lib/colors'

type Format = '1:1' | '4:5' | '9:16'
type Mode = 'quote' | 'statement' | 'stat' | 'partner'
type Accent = 'orange' | 'teal' | 'brown' | 'yellow' | 'ocean' | 'brand'

// Preview shows at half the post size — small enough to see the whole card, and
// never an upscale (export is a separate 3× render).
const PREVIEW_SCALE = 0.5

const DIMS: Record<Format, [number, number]> = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
}

const ACCENTS: Record<Accent, string> = {
  orange: colors.accentOrange,
  teal: colors.accentTeal,
  brown: colors.accentBrown,
  yellow: colors.accentYellow,
  ocean: colors.accentOcean,
  brand: colors.brand,
}

const ACCENT_SWATCHES: { id: Accent; name: string; color: string }[] = [
  { id: 'orange', name: 'Orange', color: colors.accentOrange },
  { id: 'teal', name: 'Teal', color: colors.accentTeal },
  { id: 'brown', name: 'Brown', color: colors.accentBrown },
  { id: 'yellow', name: 'Yellow', color: colors.accentYellow },
  { id: 'ocean', name: 'Ocean', color: colors.accentOcean },
  { id: 'brand', name: 'Cyan', color: colors.brand },
]

const FORMAT_OPTS = [
  { id: '1:1' as Format, label: 'Square' },
  { id: '4:5' as Format, label: 'Portrait' },
  { id: '9:16' as Format, label: 'Story' },
]
const MODE_OPTS = [
  { id: 'quote' as Mode, label: 'Quote' },
  { id: 'statement' as Mode, label: 'Statement' },
  { id: 'stat' as Mode, label: 'Stat' },
  { id: 'partner' as Mode, label: 'Logo' },
]

// hex (#rrggbb) + alpha 0-1 → rgba() string, for opacity-based hierarchy.
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Draw an image tinted to a solid color (its alpha shape, filled with `color`) so
// partner/client logos always match the card's text color. The tint buffer is sized
// to the current transform scale so it stays crisp in the 3× export.
function drawTintedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, color: string): void {
  const scale = ctx.getTransform().a || 1
  const bw = Math.max(1, Math.round(w * scale))
  const bh = Math.max(1, Math.round(h * scale))
  const off = document.createElement('canvas')
  off.width = bw
  off.height = bh
  const o = off.getContext('2d')
  if (!o) { ctx.drawImage(img, x, y, w, h); return }
  o.drawImage(img, 0, 0, bw, bh)
  o.globalCompositeOperation = 'source-in'
  o.fillStyle = color
  o.fillRect(0, 0, bw, bh)
  ctx.drawImage(off, x, y, w, h)
}

// Perceptual luminance test → pick light vs dark ink/logo for any surface color.
function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const r = lin(((n >> 16) & 255) / 255)
  const g = lin(((n >> 8) & 255) / 255)
  const b = lin((n & 255) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5
}

// Surface colors — shown as swatches; ink + logo variant are derived by luminance.
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

// Greedy word-wrap at maxWidth in the ctx's current font; respects hard \n breaks.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(''); continue }
    let line = ''
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w
      if (ctx.measureText(cand).width > maxWidth && line) { out.push(line); line = w }
      else line = cand
    }
    out.push(line)
  }
  return out
}

// Shrink font size until the wrapped text fits maxWidth (no word overflow) AND its
// block height fits maxHeight. Returns the chosen size + wrapped lines.
function fitParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  maxSize: number,
  minSize: number,
  lineHeightRatio: number,
  maxWidth: number,
  maxHeight: number,
): { size: number; lines: string[]; lineHeight: number } {
  let size = maxSize
  let lines: string[] = []
  for (; size > minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`
    lines = wrapText(ctx, text, maxWidth)
    const fitsWidth = lines.every((l) => ctx.measureText(l).width <= maxWidth)
    const fitsHeight = lines.length * size * lineHeightRatio <= maxHeight
    if (fitsWidth && fitsHeight) break
  }
  return { size, lines, lineHeight: size * lineHeightRatio }
}

// A color-swatch picker; the selected color's name shows in parentheses after the label.
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
            className={`h-7 w-7 rounded-md border transition ${
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

type LogoOption = { id: string; name: string; logo: string }

export default function SocialCardStudio({ logos = [] }: { logos?: LogoOption[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<() => void>(() => undefined)
  const [fontsReady, setFontsReady] = useState(false)
  // Logo images (dark for paper, light for ink) — wordmark + symbol, loaded once
  // and redrawn on ready.
  const markDark = useRef<HTMLImageElement | null>(null)
  const markLight = useRef<HTMLImageElement | null>(null)
  const symDark = useRef<HTMLImageElement | null>(null)
  const symLight = useRef<HTMLImageElement | null>(null)
  // Uploaded partner logo (Partner mode), as a data URL + its decoded image.
  const partnerImg = useRef<HTMLImageElement | null>(null)

  const [format, setFormat] = useState<Format>('1:1')
  const [mode, setMode] = useState<Mode>('quote')
  const [surface, setSurface] = useState<SurfaceId>('paper')
  const [accent, setAccent] = useState<Accent>('teal')
  const [logo, setLogo] = useState<'wordmark' | 'symbol' | 'none'>('wordmark')

  const [eyebrow, setEyebrow] = useState('Field notes')
  const [quote, setQuote] = useState('The best AI strategy is the one your team can actually ship.')
  const [author, setAuthor] = useState('Jane Doe')
  const [role, setRole] = useState('Partner, Tribe AI')
  const [headline, setHeadline] = useState('AI that ships, not slideware.')
  const [body, setBody] = useState('We embed senior practitioners to build production systems with your team.')
  const [statValue, setStatValue] = useState('3.2×')
  const [statLabel, setStatLabel] = useState('faster time to production')
  const [support, setSupport] = useState('Across 40+ enterprise engagements')
  const [partnerSrc, setPartnerSrc] = useState('') // file-upload override (data URL)
  const [cmsLogo, setCmsLogo] = useState('') // selected CMS partner/client id
  const [showSymbol, setShowSymbol] = useState(true) // Tribe symbol + "×" in the lockup
  const [partnerScale, setPartnerScale] = useState(1) // partner logo size, ±10%

  // Load brand fonts before the first paint so canvas text renders in Tribe faces.
  useEffect(() => {
    let alive = true
    const need = [
      '300 120px TribeSerif',
      '400 120px TribeSerif',
      '300 40px TribeSans',
      '400 24px TribeCaption',
    ]
    Promise.all(need.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => { if (alive) setFontsReady(true) })
      .catch(() => { if (alive) setFontsReady(true) })
    return () => { alive = false }
  }, [])

  // Load the wordmark once (both themes); redraw when each arrives.
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

  // The partner logo is the file-upload override if present, else the selected CMS
  // partner's logo. Decode it and redraw when it changes (or clears).
  const partnerLogoUrl = partnerSrc || logos.find((l) => l.id === cmsLogo)?.logo || ''
  useEffect(() => {
    if (!partnerLogoUrl) { partnerImg.current = null; drawRef.current(); return }
    const img = new Image()
    // Cross-origin (CMS/blob CDN) logos need CORS so the canvas stays untainted for export.
    if (!partnerLogoUrl.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => { partnerImg.current = img; drawRef.current() }
    img.onerror = () => { partnerImg.current = null; drawRef.current() }
    img.src = partnerLogoUrl
  }, [partnerLogoUrl])

  const onPartnerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setPartnerSrc(String(reader.result))
    reader.readAsDataURL(f)
  }

  // Paint the whole card in LOGICAL W×H coordinates. The caller sets the target
  // canvas size + transform (1× for the on-screen preview, 3× for export), so the
  // same drawing serves both — and the export is a true high-res render, not an
  // upscale of the preview.
  const paint = useCallback((ctx: CanvasRenderingContext2D) => {
    const [W, H] = DIMS[format]
    const surf = SURFACES.find((s) => s.id === surface) ?? SURFACES[0]
    const bg = surf.color
    const dark = isDarkColor(bg)
    const ink = dark ? colors.backgroundPrimary : colors.foregroundPrimary
    const acc = ACCENTS[accent]
    // Eyebrows use ink, independent of the accent (brand rule: never orange).
    const eyebrowColor = ink
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const M = Math.round(W * 0.1) // safe margin
    const cw = W - M * 2

    // Build the centered content stack per mode. Each segment carries its own font.
    type Seg = { lines: string[]; size: number; lineHeight: number; family: string; weight: number; color: string; alpha: number; caption?: boolean; quoteMain?: boolean; lockup?: boolean; height?: number; gapAfter: number }
    const segs: Seg[] = []
    const eb = eyebrow.trim()
    const pushEyebrow = () => {
      if (!eb) return
      const size = Math.round(W * 0.026)
      segs.push({ lines: [eb.toUpperCase()], size, lineHeight: size * 1.2, family: 'TribeCaption', weight: 400, color: eyebrowColor, alpha: 1, caption: true, gapAfter: W * 0.045 })
    }

    if (mode === 'quote') {
      pushEyebrow()
      const main = fitParagraph(ctx, quote.trim(), 'TribeSerif', 300, W * 0.115, W * 0.05, 1.18, cw, H * 0.5)
      segs.push({ lines: main.lines, size: main.size, lineHeight: main.lineHeight, family: 'TribeSerif', weight: 300, color: ink, alpha: 1, quoteMain: true, gapAfter: W * 0.05 })
      const meta = [author.trim(), role.trim()].filter(Boolean).join('   ·   ')
      if (meta) {
        const size = Math.round(W * 0.024)
        segs.push({ lines: [meta.toUpperCase()], size, lineHeight: size * 1.3, family: 'TribeCaption', weight: 400, color: ink, alpha: 0.6, caption: true, gapAfter: 0 })
      }
    } else if (mode === 'statement') {
      pushEyebrow()
      const main = fitParagraph(ctx, headline.trim(), 'TribeSerif', 300, W * 0.13, W * 0.055, 1.12, cw, H * 0.55)
      segs.push({ lines: main.lines, size: main.size, lineHeight: main.lineHeight, family: 'TribeSerif', weight: 300, color: ink, alpha: 1, gapAfter: body.trim() ? W * 0.05 : 0 })
      if (body.trim()) {
        const sub = fitParagraph(ctx, body.trim(), 'TribeSans', 300, W * 0.04, W * 0.028, 1.45, cw, H * 0.25)
        segs.push({ lines: sub.lines, size: sub.size, lineHeight: sub.lineHeight, family: 'TribeSans', weight: 300, color: ink, alpha: 0.7, gapAfter: 0 })
      }
    } else if (mode === 'stat') {
      pushEyebrow()
      const num = fitParagraph(ctx, statValue.trim(), 'TribeSerif', 300, W * 0.34, W * 0.12, 1, cw, H * 0.42)
      segs.push({ lines: num.lines, size: num.size, lineHeight: num.lineHeight, family: 'TribeSerif', weight: 300, color: acc, alpha: 1, gapAfter: W * 0.035 })
      if (statLabel.trim()) {
        const lab = fitParagraph(ctx, statLabel.trim(), 'TribeSerif', 300, W * 0.07, W * 0.04, 1.15, cw, H * 0.22)
        segs.push({ lines: lab.lines, size: lab.size, lineHeight: lab.lineHeight, family: 'TribeSerif', weight: 300, color: ink, alpha: 1, gapAfter: support.trim() ? W * 0.04 : 0 })
      }
      if (support.trim()) {
        const size = Math.round(W * 0.024)
        segs.push({ lines: [support.trim().toUpperCase()], size, lineHeight: size * 1.3, family: 'TribeCaption', weight: 400, color: ink, alpha: 0.6, caption: true, gapAfter: 0 })
      }
    } else {
      // Partner: logo lockup at the top (above the eyebrow), then eyebrow →
      // announcement → supporting line (same body style as Statement).
      segs.push({ lines: [], size: 0, lineHeight: 0, family: '', weight: 0, color: ink, alpha: 1, lockup: true, height: W * 0.11, gapAfter: W * 0.09 })
      pushEyebrow()
      if (headline.trim()) {
        const main = fitParagraph(ctx, headline.trim(), 'TribeSerif', 300, W * 0.09, W * 0.045, 1.14, cw, H * 0.3)
        segs.push({ lines: main.lines, size: main.size, lineHeight: main.lineHeight, family: 'TribeSerif', weight: 300, color: ink, alpha: 1, gapAfter: support.trim() ? W * 0.05 : 0 })
      }
      if (support.trim()) {
        const sub = fitParagraph(ctx, support.trim(), 'TribeSans', 300, W * 0.04, W * 0.028, 1.45, cw, H * 0.22)
        segs.push({ lines: sub.lines, size: sub.size, lineHeight: sub.lineHeight, family: 'TribeSans', weight: 300, color: ink, alpha: 0.7, gapAfter: 0 })
      }
    }

    // Vertically center the stack, but keep clear of the logo row at the bottom.
    const bottomReserve = logo !== 'none' ? H * 0.08 : 0
    const totalH = segs.reduce((s, seg) => s + (seg.lockup ? seg.height ?? 0 : seg.lines.length * seg.lineHeight) + seg.gapAfter, 0)
    let y = Math.max(M, (H - bottomReserve - totalH) / 2)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    // Track the quote paragraph's geometry so we can hang quotation marks around it.
    let qi: { firstY: number; lastY: number; size: number; lastW: number } | null = null
    for (const seg of segs) {
      // Partner lockup: (optional Tribe symbol ×) partner logo, left-aligned with
      // the text at the left margin, equal heights.
      if (seg.lockup) {
        const Ht = seg.height ?? W * 0.11
        const partner = partnerImg.current
        const cy = y + Ht / 2
        let x = M
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        if (showSymbol) {
          const tribe = dark ? symLight.current : symDark.current
          const pad = W * 0.04
          const sepSize = Ht * 0.55
          ctx.font = `300 ${sepSize}px TribeSerif`
          const sepW = ctx.measureText('×').width
          const tribeW = tribe ? (tribe.naturalWidth / tribe.naturalHeight) * Ht : Ht * 0.83
          if (tribe) ctx.drawImage(tribe, x, y, tribeW, Ht)
          x += tribeW + pad
          ctx.fillStyle = withAlpha(ink, 0.55)
          ctx.fillText('×', x, cy)
          x += sepW + pad
        }
        if (partner) {
          const partnerH = Ht * partnerScale
          const partnerW = (partner.naturalWidth / partner.naturalHeight) * partnerH
          // Always tint the partner/client logo to the text color for a clean lockup.
          drawTintedImage(ctx, partner, x, cy - partnerH / 2, partnerW, partnerH, ink)
        } else {
          const partnerW = Ht * 1.9
          ctx.strokeStyle = withAlpha(ink, 0.3)
          ctx.lineWidth = Math.max(1, W * 0.002)
          ctx.setLineDash([W * 0.012, W * 0.01])
          ctx.strokeRect(x, y, partnerW, Ht)
          ctx.setLineDash([])
          ctx.fillStyle = withAlpha(ink, 0.4)
          ctx.font = `400 ${Ht * 0.15}px TribeCaption`
          ctx.textAlign = 'center'
          ctx.letterSpacing = `${Ht * 0.015}px`
          ctx.fillText('PARTNER LOGO', x + partnerW / 2, cy)
          ctx.letterSpacing = '0px'
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        y += Ht + seg.gapAfter
        continue
      }
      ctx.font = `${seg.weight} ${seg.size}px ${seg.family}`
      ctx.fillStyle = seg.alpha < 1 ? withAlpha(seg.color, seg.alpha) : seg.color
      ctx.letterSpacing = seg.caption ? `${Math.max(1, seg.size * 0.09)}px` : '0px'
      const firstY = y
      seg.lines.forEach((line, li) => {
        ctx.fillText(line, M, y)
        if (seg.quoteMain && li === seg.lines.length - 1) {
          qi = { firstY, lastY: y, size: seg.size, lastW: ctx.measureText(line).width }
        }
        y += seg.lineHeight
      })
      y += seg.gapAfter
    }
    ctx.letterSpacing = '0px'

    // Hanging quotation marks — the opening mark hangs into the left margin so the
    // text stays flush at M (no indent), and both marks use the accent color.
    if (qi) {
      const q: { firstY: number; lastY: number; size: number; lastW: number } = qi
      ctx.fillStyle = acc
      ctx.font = `300 ${q.size}px TribeSerif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const gap = q.size * 0.08
      const openW = ctx.measureText('“').width
      ctx.fillText('“', M - openW - gap, q.firstY)
      ctx.fillText('”', M + q.lastW + gap, q.lastY)
    }

    // Logo (wordmark or symbol), bottom-left in the safe margin. Dark surface → light mark.
    if (logo !== 'none') {
      const mark = logo === 'wordmark'
        ? (dark ? markLight.current : markDark.current)
        : (dark ? symLight.current : symDark.current)
      const h = logo === 'wordmark' ? W * 0.03 : W * 0.05
      if (mark && mark.naturalWidth) {
        const w = (mark.naturalWidth / mark.naturalHeight) * h
        ctx.drawImage(mark, M, H - M - h, w, h)
      }
    }
  }, [format, mode, surface, accent, logo, showSymbol, partnerScale, eyebrow, quote, author, role, headline, body, statValue, statLabel, support])

  // On-screen preview: the backing store is the card's native size (1× — never
  // upscaled), painted at identity transform.
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

  // Keep the ref pointing at the latest draw so the async wordmark onload redraws
  // with current settings; and redraw whenever draw (any input) or the fonts change.
  useEffect(() => { drawRef.current = draw }, [draw])
  useEffect(() => { draw() }, [draw, fontsReady])

  // Export at 3× the post size — a true high-res render (paint under a 3× transform),
  // so the file is crisp when uploaded, not an upscale of the on-screen preview.
  const EXPORT_SCALE = 3
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
    off.toBlob(
      (blob) => { if (blob) downloadBlob(blob, `tribe-${mode}-card-${format.replace(':', 'x')}@3x.${fmt}`) },
      mime,
      fmt === 'webp' ? 0.95 : undefined,
    )
  }

  const [w, h] = DIMS[format]

  return (
    <GeneratorShell
      title="Social Card"
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
              // Show at half the post size (never upscaled), or smaller to fit the viewport.
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
      <SegmentedControl label="Mode" value={mode} options={MODE_OPTS} onChange={setMode} columns={2} />
      <SwatchPicker
        label="Surface"
        value={surface}
        options={SURFACES.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        onChange={setSurface}
      />
      <SwatchPicker label="Accent" value={accent} options={ACCENT_SWATCHES} onChange={setAccent} />

      <Divider label="Content" />

      {mode === 'partner' && (
        <>
          <Field label="Logo">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={cmsLogo}
                  onChange={(e) => setCmsLogo(e.target.value)}
                  className="w-full appearance-none rounded-md border border-foreground-primary/15 bg-transparent py-2 pl-3 pr-8 font-sans text-xs text-foreground-primary cursor-pointer hover:bg-foreground-primary/5 focus:border-brand focus:outline-none"
                >
                  <option value="">— None —</option>
                  {logos.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-primary/40 text-[10px]">▾</span>
              </div>
              <label
                title={partnerSrc ? 'Replace uploaded logo' : 'Upload a logo'}
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors ${
                  partnerSrc ? 'border-brand text-brand' : 'border-foreground-primary/15 text-foreground-primary/70 hover:bg-foreground-primary/5'
                }`}
              >
                <Upload size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={onPartnerFile} />
              </label>
              {partnerSrc && (
                <button
                  type="button"
                  title="Remove uploaded logo"
                  onClick={() => setPartnerSrc('')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground-primary/15 text-foreground-primary/50 transition-colors hover:bg-foreground-primary/5 hover:text-foreground-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </Field>
          <Slider
            label="Logo size"
            min={0.5}
            max={1.2}
            step={0.01}
            value={partnerScale}
            onChange={setPartnerScale}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Toggle label="Tribe symbol" checked={showSymbol} onChange={setShowSymbol} />
        </>
      )}

      <TextInput label="Eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="Optional kicker" />

      {mode === 'quote' && (
        <>
          <Textarea label="Quote" value={quote} onChange={setQuote} rows={4} placeholder="The quote — no quotation marks needed" />
          <TextInput label="Name" value={author} onChange={setAuthor} placeholder="Attribution" />
          <TextInput label="Role" value={role} onChange={setRole} placeholder="Title, company" />
        </>
      )}
      {mode === 'statement' && (
        <>
          <Textarea label="Headline" value={headline} onChange={setHeadline} rows={3} placeholder="The statement" />
          <Textarea label="Supporting line" value={body} onChange={setBody} rows={3} placeholder="Optional" />
        </>
      )}
      {mode === 'stat' && (
        <>
          <TextInput label="Stat" value={statValue} onChange={setStatValue} placeholder="e.g. 3.2× or 92%" />
          <Textarea label="Label" value={statLabel} onChange={setStatLabel} rows={2} placeholder="What the number means" />
          <TextInput label="Support" value={support} onChange={setSupport} placeholder="Optional context" />
        </>
      )}
      {mode === 'partner' && (
        <>
          <Textarea label="Announcement" value={headline} onChange={setHeadline} rows={3} placeholder="e.g. Tribe AI partners with Acme" />
          <Textarea label="Supporting line" value={support} onChange={setSupport} rows={2} placeholder="Optional" />
        </>
      )}

      <Divider label="Style" />
      <SegmentedControl
        label="Watermark"
        value={logo}
        options={[
          { id: 'wordmark' as const, label: 'Wordmark' },
          { id: 'symbol' as const, label: 'Symbol' },
          { id: 'none' as const, label: 'None' },
        ]}
        onChange={setLogo}
        columns={3}
      />
    </GeneratorShell>
  )
}
