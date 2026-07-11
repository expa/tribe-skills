'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import TusiAnimation, { type OverlayDots, type BaseColorFade } from '../../components/TusiAnimation'
import { colors } from '../../../lib/colors'
import { GeneratorShell } from '../../components/generators/GeneratorShell'
import { Slider, Toggle, Button } from '../../components/generators/ui'
import { ExportMenu } from '../../components/generators/ExportMenu'
import { canvasToRasterBlob, recordCanvasWebM, captureCanvasFrames, downloadBlob } from '../../components/generators/download'
import { buildZip } from '../../components/generators/zip'

// ─── Constants ────────────────────────────────────────────────────────────────

// PNG/WEBP exports re-render the figure so its LONGEST edge hits this many px
// (true high-res render, not an upscale). Big enough that Google Slides etc.
// only ever downscale it → crisp lines. Ratio is clamped to MAX_EXPORT_RATIO.
const EXPORT_EDGE = 6000
const MAX_EXPORT_RATIO = 10   // backing-store ceiling, guards memory on big panes
// Image-sequence output frame (4K UHD). Frames are contain-fit into this, and the
// figure is rendered at a high pixel ratio during capture so the result stays crisp.
const SEQ_W = 3840
const SEQ_H = 2160
const SEQ_MAX_FRAMES = 1800   // ~30-60s of manual recording; 4K frames are memory-heavy
const LS_KEY        = 'tribe-animation-settings'
const FRAMES_LS_KEY = 'tribe-animation-frames'

const DEFAULTS = {
  numRails:        6,
  showOuter:       false,
  showInner:       true,
  showRails:       false,
  phase:           false,
  overlap:         false,
  tilt:            0,
  rotation:        0,
  draw:            100,
  showConnections: false,
  showCrown:       false,
  dotSize:         10,
  speed:           10,
  trailSize:       0,
  circleSize:      50,
  xOffset:         0,
  // Wireframe-sphere rings (the homepage "orbiting rings"). Off by default
  // (meridians ≤ 1 → no sphere); the Orbit preset turns them on.
  meridians:       0,
  meridianSpread:  360,
  meridianDraw:    100,
  spinRings:       false,
  // Ring-dot "orbit" mode (dots anchored one-per-ring, like the industries figure).
  // Distinct from `meridians` (the wireframe-sphere ring count) so the studio can
  // render the homepage sphere states — meridians > 0 WITHOUT ring-dot mode.
  orbit:           false,
  // Multiply blend for the main dots — the website passes dotBlendMode="multiply"
  // on EVERY section, so all the section presets carry this.
  multiplyDots:    false,
  // Homepage hero treatment: the hard-light overlay dot layer + the intro
  // base-colour crossfade over an opaque background (see HERO_* below). Home/Intro
  // only. Independent of multiplyDots (which every section uses).
  heroOverlay:     false,
}

// The homepage hero's layered/blended dots, mirrored from AnimationController
// (HERO_OVERLAY_DOTS / HERO_BASE_DOTS) so the Home/Intro presets reproduce it.
// The scroll-driven fades (fadeVh, shift.selector) simply stay at their resting
// state in the studio (no scroll), which is the look we want.
const HERO_OVERLAY: OverlayDots = {
  colors:      [colors.hardLightBlue, colors.accentOrange],
  blendMode:   'hard-light',
  sizeMul:     2.7,
  trailFrames: 100,
  fadeVh:      0.25,
  minShrink:   1,
}
const HERO_BASE_FADE: BaseColorFade = {
  colors: [colors.introDotBlue, colors.introDotBrown],
  fadeVh: 0.6,
  shift: { selector: '#model', colors: [null, colors.accentYellow, colors.accentOrange] },
}

// One-click "Orbit" preset — a tumbling wireframe sphere with one dot anchored
// to each ring (ring-dot mode, like the industries figure), so the dots scatter
// across different rings rather than all riding the centre rim. Ring-dot mode
// is driven off `meridians > 1` in the render (see ringDots/solidRings props).
const ORBIT_PRESET: Settings = {
  ...DEFAULTS,
  numRails: 8, showOuter: true, showInner: false, showRails: false, overlap: true,
  tilt: 85, draw: 0, dotSize: 24, speed: 20, trailSize: 0, circleSize: 40,
  meridians: 8, meridianSpread: 360, meridianDraw: 100, spinRings: true, orbit: true,
}

// Tap-to-switch presets for each section of the live website, derived from the
// figure states in AnimationController.STATES (S_INTRO / S0-#home / S1-#what-we-do /
// S2-#model / S3-#partners / NAV_STATE). Fields the studio doesn't yet expose
// (pan, crownDensity, dotScale, dotStagger) are dropped, and xOffset is left at 0
// (the states use a fraction-of-viewport offset that doesn't map to the studio px
// slider), so these are faithful-but-not-pixel-exact starting points.
const SECTION_PRESETS: { name: string; settings: Settings }[] = [
  { name: 'Home', settings: { ...DEFAULTS,
    numRails: 2, showOuter: true, showInner: true, showRails: true, phase: false, overlap: true,
    tilt: 85, rotation: 0, draw: 0, showConnections: false, showCrown: false,
    dotSize: 24, speed: 15, trailSize: 20, circleSize: 60,
    meridians: 8, meridianSpread: 360, meridianDraw: 100, spinRings: true, orbit: false, multiplyDots: true, heroOverlay: true } },
  { name: 'What we do', settings: { ...DEFAULTS,
    numRails: 2, showOuter: true, showInner: true, showRails: true, phase: false, overlap: false,
    tilt: 0, rotation: 90, draw: 100, showConnections: true, showCrown: false,
    dotSize: 20, speed: 24, trailSize: 0, circleSize: 40,
    meridians: 8, meridianSpread: 0, meridianDraw: 100, spinRings: true, orbit: false, multiplyDots: true } },
  { name: 'Model', settings: { ...DEFAULTS,
    numRails: 20, showOuter: true, showInner: false, showRails: true, phase: true, overlap: false,
    tilt: 0, rotation: 0, draw: 100, showConnections: true, showCrown: true,
    dotSize: 20, speed: 6, trailSize: 0, circleSize: 60,
    meridians: 0, spinRings: false, orbit: false, multiplyDots: true } },
  { name: 'Partners', settings: { ...DEFAULTS,
    numRails: 6, showOuter: false, showInner: true, showRails: false, phase: false, overlap: false,
    tilt: 0, rotation: 0, draw: 100, showConnections: false, showCrown: false,
    dotSize: 20, speed: 6, trailSize: 0, circleSize: 50,
    meridians: 0, spinRings: false, orbit: false, multiplyDots: true } },
]

function settingsEqual(a: Settings, b: Settings): boolean {
  return (Object.keys(DEFAULTS) as (keyof Settings)[]).every(k => a[k] === b[k])
}

// Per-ring dot colours, cycled across the rings (ring-dot mode falls back to a
// near-invisible neutral without an explicit colour). Matches the dot palette.
const RING_DOT_PALETTE = [colors.brand, colors.accentOrange, colors.accentYellow, colors.accentBrown]

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    // Back-compat: before `orbit` existed, meridians > 1 WAS the ring-dot flag.
    if (parsed.orbit === undefined) parsed.orbit = parsed.meridians > 1
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

type Settings = typeof DEFAULTS

// ─── Preset bar (overlays the canvas, top-left) ───────────────────────────────
// One row: the website section presets first (tap to switch the figure), then any
// custom looks saved to browser cache (draggable to reorder, × to delete), then a
// + to save the current look as a new custom preset.

function PresetBar({
  presets, activeName, onLoadPreset,
  frames, activeIdx, onLoad, onDelete, onSave, onReorder,
}: {
  presets: { name: string; settings: Settings }[]
  activeName: string | null
  onLoadPreset: (settings: Settings) => void
  frames: Settings[]
  activeIdx: number | null
  onLoad: (i: number) => void
  onDelete: (i: number) => void
  onSave: () => void
  onReorder: (from: number, to: number) => void
}) {
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function handleDragStart(e: React.DragEvent, i: number) {
    setDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (i !== dragIdx) setDragOverIdx(i)
  }
  function handleDrop(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i)
    setDragIdx(null)
    setDragOverIdx(null)
  }
  function handleDragEnd() {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Website section presets */}
      {presets.map((p) => (
        <button
          key={p.name}
          onClick={() => onLoadPreset(p.settings)}
          className={`flex h-8 items-center justify-center rounded-md border px-2.5 font-caption text-[10px] uppercase tracking-[1.4px] transition-colors cursor-pointer ${
            activeName === p.name
              ? 'border-brand bg-brand text-foreground-primary'
              : 'border-foreground-primary/15 bg-background-primary text-foreground-primary/60 hover:bg-foreground-primary/5'
          }`}
        >
          {p.name}
        </button>
      ))}

      {/* Divider between fixed presets and custom saves */}
      {frames.length > 0 && <span className="mx-0.5 h-5 w-px shrink-0 bg-foreground-primary/15" />}

      {/* Custom saved looks — delete is a corner nub so each stays h-8 and lines up */}
      {frames.map((_, i) => (
        <div
          key={i}
          className="relative shrink-0"
          draggable
          onDragStart={e => handleDragStart(e, i)}
          onDragOver={e => handleDragOver(e, i)}
          onDrop={e => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          style={{ opacity: dragIdx === i ? 0.35 : 1, transition: 'opacity 0.1s' }}
        >
          <button
            onClick={() => onLoad(i)}
            style={{ cursor: 'grab', outline: dragOverIdx === i ? `2px solid ${colors.brand}` : 'none', outlineOffset: '2px' }}
            className={`flex h-8 w-8 items-center justify-center rounded-md border font-sans text-[10px] font-semibold tabular-nums transition-colors ${
              activeIdx === i
                ? 'border-brand bg-brand text-foreground-primary'
                : 'border-foreground-primary/15 bg-background-primary text-foreground-primary/60 hover:bg-foreground-primary/5'
            }`}
          >
            {i + 1}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(i) }}
            aria-label="Delete preset"
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-foreground-primary/15 bg-background-primary text-[9px] leading-none text-foreground-primary/50 transition-colors hover:border-accent-orange hover:text-accent-orange cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onSave}
        aria-label="Save current look as a preset"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-foreground-primary/25 text-sm text-foreground-primary/50 transition-opacity hover:opacity-60 cursor-pointer"
      >
        +
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnimationPage() {
  const [numRails,   setNumRails]   = useState(DEFAULTS.numRails)
  const [showOuter,  setShowOuter]  = useState(DEFAULTS.showOuter)
  const [showInner,  setShowInner]  = useState(DEFAULTS.showInner)
  const [showRails,  setShowRails]  = useState(DEFAULTS.showRails)
  const [phase,      setPhase]      = useState(DEFAULTS.phase)
  const [overlap,    setOverlap]    = useState(DEFAULTS.overlap)
  const [tilt,       setTilt]       = useState(DEFAULTS.tilt)
  const [rotation,   setRotation]   = useState(DEFAULTS.rotation)
  const [draw,            setDraw]            = useState(DEFAULTS.draw)
  const [showConnections, setShowConnections] = useState(DEFAULTS.showConnections)
  const [showCrown,       setShowCrown]       = useState(DEFAULTS.showCrown)
  const [dotSize,    setDotSize]    = useState(DEFAULTS.dotSize)
  const [speed,      setSpeed]      = useState(DEFAULTS.speed)
  const [trailSize,  setTrailSize]  = useState(DEFAULTS.trailSize)
  const [circleSize, setCircleSize] = useState(DEFAULTS.circleSize)
  const [xOffset,    setXOffset]    = useState(DEFAULTS.xOffset)
  const [meridians,      setMeridians]      = useState(DEFAULTS.meridians)
  const [meridianSpread, setMeridianSpread] = useState(DEFAULTS.meridianSpread)
  const [meridianDraw,   setMeridianDraw]   = useState(DEFAULTS.meridianDraw)
  const [spinRings,      setSpinRings]      = useState(DEFAULTS.spinRings)
  const [orbit,          setOrbit]          = useState(DEFAULTS.orbit)
  const [multiplyDots,   setMultiplyDots]   = useState(DEFAULTS.multiplyDots)
  const [heroOverlay,    setHeroOverlay]    = useState(DEFAULTS.heroOverlay)

  const [frames,         setFrames]        = useState<Settings[]>([])
  const [activeFrameIdx, setActiveFrameIdx] = useState<number | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [exporting, setExporting] = useState(false)
  // Image-sequence recording: shows the Stop button + live frame count while capturing.
  const [recordingFrames, setRecordingFrames] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const stopRecordingRef = useRef(false)
  // Forces the figure to re-render at this pixel ratio during a raster export
  // (null = normal device DPR). Image exports composite at EXPORT_SCALE×.
  const [exportScale, setExportScale] = useState<number | null>(null)
  const loadingFrame = useRef(false)
  const framesLoaded = useRef(false)
  const animRef = useRef<HTMLDivElement>(null)

  // Two independent ways rings reach the figure:
  //   • orbit (ring-dot mode) — one dot anchored per ring, ring count follows Rails.
  //     Each ring gets an explicit dot colour (cycled) so the dots stay visible.
  //   • meridians — the wireframe-sphere ring count (homepage sphere), normal dots.
  // Passing `meridians={ringCount}` for both keeps a single figure prop; orbit wins
  // the ring count when on, otherwise the literal meridians slider drives the sphere.
  const ringCount = orbit ? numRails : meridians
  const ringDotColors = useMemo(
    () => (orbit
      ? Array.from({ length: numRails }, (_, i) => RING_DOT_PALETTE[i % RING_DOT_PALETTE.length])
      : undefined),
    [orbit, numRails],
  )

  const currentSettings = getCurrentSettings()
  const activeSectionName = SECTION_PRESETS.find(p => settingsEqual(p.settings, currentSettings))?.name ?? null

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const s = loadSettings()
    setNumRails(s.numRails); setShowOuter(s.showOuter); setShowInner(s.showInner)
    setShowRails(s.showRails); setPhase(s.phase); setOverlap(s.overlap)
    setTilt(s.tilt); setRotation(s.rotation); setDraw(s.draw)
    setShowConnections(s.showConnections); setShowCrown(s.showCrown)
    setDotSize(s.dotSize); setSpeed(s.speed); setTrailSize(s.trailSize)
    setCircleSize(s.circleSize); setXOffset(s.xOffset)
    setMeridians(s.meridians); setMeridianSpread(s.meridianSpread)
    setMeridianDraw(s.meridianDraw); setSpinRings(s.spinRings); setOrbit(s.orbit)
    setMultiplyDots(s.multiplyDots); setHeroOverlay(s.heroOverlay)

    try {
      const raw = localStorage.getItem(FRAMES_LS_KEY)
      if (raw) setFrames(JSON.parse(raw))
    } catch { /* ignore */ }
    framesLoaded.current = true
  }, [])

  // Persist settings whenever anything changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        numRails, showOuter, showInner, showRails, showConnections, showCrown, phase, overlap,
        tilt, rotation, draw, dotSize, speed, trailSize, circleSize, xOffset,
        meridians, meridianSpread, meridianDraw, spinRings, orbit, multiplyDots, heroOverlay,
      }))
    } catch { /* ignore */ }
  }, [numRails, showOuter, showInner, showRails, showConnections, showCrown, phase, overlap, tilt, rotation, draw, dotSize, speed, trailSize, circleSize, xOffset, meridians, meridianSpread, meridianDraw, spinRings, orbit, multiplyDots, heroOverlay])

  // Persist frames — skip until after the initial load to avoid overwriting with []
  useEffect(() => {
    if (!framesLoaded.current) return
    try { localStorage.setItem(FRAMES_LS_KEY, JSON.stringify(frames)) } catch { /* ignore */ }
  }, [frames])

  // Clear active frame when settings diverge from it (but not while loading a frame)
  useEffect(() => {
    if (loadingFrame.current || activeFrameIdx === null) return
    const f = frames[activeFrameIdx]
    if (!f) { setActiveFrameIdx(null); return }
    const matches =
      f.numRails === numRails && f.showOuter === showOuter && f.showInner === showInner &&
      f.showRails === showRails && f.phase === phase && f.overlap === overlap &&
      f.tilt === tilt && f.rotation === rotation && f.draw === draw &&
      f.showConnections === showConnections && f.showCrown === showCrown &&
      f.dotSize === dotSize && f.speed === speed && f.trailSize === trailSize &&
      f.circleSize === circleSize && f.xOffset === xOffset &&
      f.meridians === meridians && f.meridianSpread === meridianSpread &&
      f.meridianDraw === meridianDraw && f.spinRings === spinRings && f.orbit === orbit &&
      f.heroOverlay === heroOverlay && f.multiplyDots === multiplyDots
    if (!matches) setActiveFrameIdx(null)
  }, [numRails, showOuter, showInner, showRails, phase, overlap, tilt, rotation, draw, showConnections, showCrown, dotSize, speed, trailSize, circleSize, xOffset, meridians, meridianSpread, meridianDraw, spinRings, orbit, multiplyDots, heroOverlay]) // eslint-disable-line react-hooks/exhaustive-deps

  function getCurrentSettings(): Settings {
    return { numRails, showOuter, showInner, showRails, phase, overlap, tilt, rotation, draw, showConnections, showCrown, dotSize, speed, trailSize, circleSize, xOffset, meridians, meridianSpread, meridianDraw, spinRings, orbit, multiplyDots, heroOverlay }
  }

  function applySettings(s: Settings) {
    loadingFrame.current = true
    setNumRails(s.numRails); setShowOuter(s.showOuter); setShowInner(s.showInner)
    setShowRails(s.showRails); setPhase(s.phase); setOverlap(s.overlap)
    setTilt(s.tilt); setRotation(s.rotation); setDraw(s.draw)
    setShowConnections(s.showConnections); setShowCrown(s.showCrown)
    setDotSize(s.dotSize); setSpeed(s.speed); setTrailSize(s.trailSize)
    setCircleSize(s.circleSize); setXOffset(s.xOffset)
    setMeridians(s.meridians); setMeridianSpread(s.meridianSpread)
    setMeridianDraw(s.meridianDraw); setSpinRings(s.spinRings); setOrbit(s.orbit)
    setMultiplyDots(s.multiplyDots); setHeroOverlay(s.heroOverlay)
    requestAnimationFrame(() => { loadingFrame.current = false })
  }

  // Tap a section preset → apply its look (and drop any active custom frame).
  function loadSectionPreset(s: Settings) {
    applySettings(s)
    setActiveFrameIdx(null)
  }

  function saveFrame() {
    const s = getCurrentSettings()
    setFrames(prev => {
      const next = [...prev, s]
      setActiveFrameIdx(next.length - 1)
      return next
    })
  }

  function loadFrame(i: number) {
    applySettings(frames[i])
    setActiveFrameIdx(i)
  }

  function deleteFrame(i: number) {
    setFrames(prev => prev.filter((_, idx) => idx !== i))
    setActiveFrameIdx(prev => {
      if (prev === null) return null
      if (prev === i) return null
      if (prev > i) return prev - 1
      return prev
    })
  }

  function reorderFrame(from: number, to: number) {
    setFrames(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setActiveFrameIdx(prev => {
      if (prev === null) return null
      if (prev === from) return to
      if (from < to && prev > from && prev <= to) return prev - 1
      if (from > to && prev >= to && prev < from) return prev + 1
      return prev
    })
  }

  // Keyboard: 1–9 jumps to frame
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const n = parseInt(e.key)
      if (n >= 1 && n <= 9 && frames[n - 1]) loadFrame(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frames]) // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
    applySettings(DEFAULTS)
    setActiveFrameIdx(null)
  }

  // Orbit toggle: on → the homepage orbiting-rings figure (tweakable from there
  // with the sliders), off → back to the default figure.
  function toggleOrbit(on: boolean) {
    applySettings(on ? ORBIT_PRESET : DEFAULTS)
    setActiveFrameIdx(null)
  }

  function copyParams() {
    // In orbit mode the preview renders four ring-dot props the base Settings
    // don't carry, and the live `meridians` prop is the ring count (numRails),
    // not the on/off flag. Emit a complete, paste-ready prop set so a consumer
    // gets exactly what's on screen — otherwise the dots fall back to riding
    // the rim (the "weird positioning" we hit on the careers page).
    const base = orbit
      ? { ...getCurrentSettings(), meridians: numRails, ringDots: true, ringDotColors, ringSpinScale: speed / 20, showIntersections: false }
      : getCurrentSettings()
    // multiplyDots → the website's dotBlendMode="multiply"; hero overlay adds the
    // layered dots + base-colour crossfade over an opaque background.
    const withBlend = multiplyDots ? { ...base, dotBlendMode: 'multiply' } : base
    const out = heroOverlay
      ? { ...withBlend, background: colors.backgroundPrimary, overlayDots: HERO_OVERLAY, baseColorFade: HERO_BASE_FADE }
      : withBlend
    navigator.clipboard.writeText(JSON.stringify(out, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // PNG/WEBP composite the live canvas over the page background (or export it
  // transparent when cropping to the figure); WEBM records ~4s of the live
  // animation. Images re-render at high resolution first (see exportAtScale).
  async function handleExport(format: string) {
    const canvas = animRef.current?.querySelector('canvas')
    if (!canvas) return
    setExporting(true)
    try {
      if (format === 'webm') {
        const blob = await recordCanvasWebM(canvas, 4000)
        downloadBlob(blob, 'tribe-animation.webm')
      } else if (format === 'frames') {
        // Record the live animation as a 4K (3840×2160) PNG image sequence (every
        // rendered frame, no encoder drops) until the user taps Stop, packaged as a
        // .zip. The figure is rendered at a high pixel ratio during capture, then each
        // frame is contain-fit + centered over the studio background into the 4K frame,
        // so the PNGs are crisp and non-transparent. Assemble later with e.g.
        // `ffmpeg -framerate 30 -i frame_%04d.png out.mp4`.
        stopRecordingRef.current = false
        setFrameCount(0)
        setRecordingFrames(true)
        try {
          // Render at a pixel ratio high enough that the 4K frame never upscales, then
          // wait for the enlarged backing store to actually paint before recording.
          const rect = canvas.getBoundingClientRect()
          const scale = Math.min(MAX_EXPORT_RATIO, Math.max(SEQ_W / rect.width, SEQ_H / rect.height))
          const targetW = Math.round(rect.width * scale)
          setExportScale(scale)
          const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
          for (let i = 0; i < 30 && canvas.width !== targetW; i++) await raf()
          await raf()

          const background = heroOverlay || multiplyDots ? colors.backgroundPrimary : colors.backgroundSoft
          const framesData = await captureCanvasFrames(canvas, {
            background,
            width: SEQ_W,
            height: SEQ_H,
            maxFrames: SEQ_MAX_FRAMES,
            shouldStop: () => stopRecordingRef.current,
            onFrame: (n) => setFrameCount(n),
          })
          if (framesData.length > 0) {
            const pad = String(framesData.length - 1).length
            const zip = buildZip(
              framesData.map((data, i) => ({ name: `frame_${String(i).padStart(pad, '0')}.png`, data })),
            )
            downloadBlob(zip, 'tribe-animation-frames.zip')
          }
        } finally {
          setRecordingFrames(false)
        }
      } else {
        // Re-render so the pane's longest edge ≈ EXPORT_EDGE px.
        const rect = canvas.getBoundingClientRect()
        const scale = Math.min(
          Math.max(EXPORT_EDGE / Math.max(rect.width, rect.height), 1),
          MAX_EXPORT_RATIO,
        )
        // Always crop to the figure (+10% margin) and skip the background fill →
        // transparent PNG/WEBP that drops onto any slide bg.
        await exportAtScale(canvas, scale, async () => {
          const blob = await canvasToRasterBlob(canvas, format as 'png' | 'webp', undefined, {
            trim: true,
            padding: 0.1,
          })
          if (blob) downloadBlob(blob, `tribe-animation.${format}`)
        })
      }
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setExportScale(null)
      setExporting(false)
    }
  }

  // Bump the figure's pixel ratio, wait for the backing store to actually grow
  // to scale× the CSS box AND a fresh frame to paint at that size, run the
  // capture, then let the finally{} in handleExport restore normal DPR.
  async function exportAtScale(
    canvas: HTMLCanvasElement,
    scale: number,
    capture: () => Promise<void>,
  ) {
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    const targetW = Math.round(canvas.getBoundingClientRect().width * scale)
    setExportScale(scale)
    // Wait (≤30 frames) for the resize effect + a render pass at the new size.
    for (let i = 0; i < 30 && canvas.width !== targetW; i++) await raf()
    await raf() // one more so the enlarged backing store is painted, not blank
    await capture()
  }

  return (
    <GeneratorShell
      title="Animation"
      canvas={
        <div ref={animRef} className="absolute inset-0 bg-background-soft">
          <div className="absolute top-4 left-4 z-10 max-w-[80%]">
            <PresetBar
              presets={SECTION_PRESETS}
              activeName={activeSectionName}
              onLoadPreset={loadSectionPreset}
              frames={frames}
              activeIdx={activeFrameIdx}
              onLoad={loadFrame}
              onDelete={deleteFrame}
              onSave={saveFrame}
              onReorder={reorderFrame}
            />
          </div>
          <TusiAnimation
            numRails={numRails} showOuter={showOuter} showInner={showInner}
            showRails={showRails} showConnections={showConnections} showCrown={showCrown} phase={phase} overlap={overlap}
            tilt={tilt} rotation={rotation} draw={draw}
            dotSize={dotSize} speed={speed} trailSize={trailSize} circleSize={circleSize}
            xOffset={xOffset}
            meridians={ringCount} meridianSpread={meridianSpread} meridianDraw={meridianDraw} spinRings={spinRings}
            ringDots={orbit} ringDotColors={ringDotColors} ringSpinScale={speed / 20}
            showIntersections={false}
            // Multiply only shows against an opaque backdrop, so give the canvas the
            // site's page colour whenever the dots blend (matches how the website's
            // multiply reads). Hero overlay uses the same colour for its layered dots.
            background={heroOverlay || multiplyDots ? colors.backgroundPrimary : null}
            overlayDots={heroOverlay ? HERO_OVERLAY : null}
            baseColorFade={heroOverlay ? HERO_BASE_FADE : null}
            dotBlendMode={multiplyDots ? 'multiply' : 'source-over'}
            exportPixelRatio={exportScale}
          />
          {recordingFrames && (
            <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
              <button
                onClick={() => { stopRecordingRef.current = true }}
                className="flex items-center gap-2 rounded-full border border-accent-orange bg-background-primary px-4 py-2.5 font-caption text-[10px] uppercase tracking-[1.6px] text-accent-orange shadow-[0_10px_30px_-10px_rgba(6,20,27,0.4)] transition-colors hover:bg-accent-orange hover:text-background-primary cursor-pointer"
              >
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
                Stop recording · {frameCount} frames
              </button>
            </div>
          )}
        </div>
      }
      footer={
        <>
          <Button variant="outline" active={copied} onClick={copyParams}>
            {copied ? 'Copied!' : 'Copy params'}
          </Button>
          <Button variant="outline" onClick={reset}>Reset</Button>
          <ExportMenu
            busy={exporting}
            onExport={handleExport}
            formats={[
              { id: 'png',    label: 'PNG image' },
              { id: 'webp',   label: 'WEBP image' },
              { id: 'webm',   label: 'WEBM video (4s)' },
              { id: 'frames', label: 'Image sequence (PNG, 4s)' },
            ]}
          />
        </>
      }
    >
      {/* Original control set. The extra settings (meridians / spread / draw / spin,
          multiply dots, hero overlay, and the ring-dot orbit decoupling) still exist and
          are driven by the section presets — they're intentionally not surfaced here. */}
      <Slider label="Rails"       value={numRails}   min={1}    max={24}  onChange={setNumRails} />
      <Slider label="Circle size" value={circleSize} min={10}   max={90}  onChange={setCircleSize} />
      <Slider label="Speed"       value={speed}      min={1}    max={100} onChange={setSpeed} />
      <Slider label="Dot size"    value={dotSize}    min={0}    max={80}  onChange={setDotSize} />
      <Slider label="Trail"       value={trailSize}  min={0}    max={60}  onChange={setTrailSize} />
      <Slider label="Draw"        value={draw}       min={0}    max={100} onChange={setDraw} />
      <Slider label="X offset"    value={xOffset}    min={-500} max={500} onChange={setXOffset} />
      <Slider label="Tilt"        value={tilt}       min={-90}  max={90}  onChange={setTilt} />
      <Slider label="Rotation"    value={rotation}   min={-90}  max={90}  onChange={setRotation} />
      <Toggle checked={showOuter}       onChange={setShowOuter}       label="Outer circle" />
      <Toggle checked={showRails}       onChange={setShowRails}       label="Rails" />
      <Toggle checked={showInner}       onChange={setShowInner}       label="Inner circles" />
      <Toggle checked={showConnections} onChange={setShowConnections} label="Connections" />
      <Toggle checked={showCrown}       onChange={setShowCrown}       label="Crown" />
      <Toggle checked={phase}           onChange={setPhase}           label="Rolling" />
      <Toggle checked={overlap}         onChange={setOverlap}         label="Overlap" />
      <Toggle checked={orbit}           onChange={toggleOrbit}        label="Orbit (rings)" />
    </GeneratorShell>
  )
}
