'use client'

import { useEffect, useRef } from 'react'
import { colors } from '../../lib/colors'
import { layoutHeroText, drawHeroText, layoutSentence, drawSentence, SENTENCE_REVEAL_DUR, SENTENCE_SCALE_DUR, type HeroTextContent, type HeroTextLayout, type SentenceLayout } from './heroCanvasText'
import { sentenceRanges, regionProgress } from '../../lib/stickyTiming'

// ─── Constants ────────────────────────────────────────────────────────────────

// Below this canvas width we treat the layout as mobile. There the rightward
// figure shift (#model) is allowed to bleed off the right edge instead of being
// clamped fully on-screen — see the xOffset clamp in the draw loop. Matches
// NAV_MOBILE_BREAKPOINT so "mobile" means the same width everywhere.
const MOBILE_BLEED_MAX_W = 768

const CIRCLE_COLOR       = colors.backgroundTertiary
const DOT_COLORS         = [colors.brand, colors.accentOrange, colors.accentYellow, colors.accentBrown]
const DOT_COLOR_FALLBACK = colors.backgroundTertiary

function dotColor(i: number) {
  return i < DOT_COLORS.length ? DOT_COLORS[i] : DOT_COLOR_FALLBACK
}

// Deterministic pseudo-random in [0,1) from an integer seed. Stable across
// frames (unlike Math.random) so the "random" ring rotations stay put on the
// resting cover instead of jittering every repaint.
function hashRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Mix two #rrggbb colors by t∈[0,1]; returns an rgb() string.
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255
  const m  = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RailState = {
  angle:       number
  targetAngle: number
  alpha:       number
  targetAlpha: number
  dying:       boolean
  colorIndex:  number
  stagger:     number  // current per-rail phase offset (radians); eases toward
                       // -i·dotStagger by shortest path, like `angle` does — so a
                       // stagger change blooms in over time instead of whirling
                       // the back rails through huge scrubbed arcs
}

export type TusiAnimationProps = {
  numRails?:        number
  showOuter?:       boolean
  showInner?:       boolean
  showRails?:       boolean
  phase?:           boolean
  overlap?:         boolean
  tilt?:            number   // degrees, -90 to 90 (X-axis perspective)
  rotation?:        number   // degrees, -90 to 90 (Z-axis flat rotation)
  pan?:             number   // degrees, Y-axis 3D rotation (turns the whole figure left/right in perspective)
  restTilt?:        number   // degrees, the resting tilt the mouse parallax pivots around (so per-ring pace acts on the mouse offset only)
  restPan?:         number   // degrees, the resting pan the mouse parallax pivots around
  draw?:            number   // 0-100, how much of each circle/line is drawn
  showConnections?: boolean  // orbit circle + center dots + connection lines
  showCrown?:       boolean  // radial lines outside the main circle
  crownDensity?:    number   // crown radial lines per rail (default 20)
  meridians?:       number   // total wireframe-sphere outline rings (incl. the main outline); each extra ring is the main circle rotated about the X-axis. 0 = off
  meridianSpread?:  number   // degrees scaling each extra ring's random rotation: 0 = collapsed onto the main outline, 360 = full random tumble
  meridianDraw?:    number   // 0-100, entrance opacity of the extra rings (fade-in while they rotate out)
  showIntersections?: boolean // draw a dot at every ring–ring crossing in the still section (default true)
  spinRings?:       boolean   // slowly, continuously rotate the extra rings while at rest (default false)
  uniformSpin?:     boolean   // spinRings variant: every ring shares one pace + spin so the group rotates rigidly together (default false → each ring drifts at its own rate)
  ringSpinScale?:   number    // multiplier on the non-uniform ring spin rate (default 1). >1 spins faster; lets a caller drive ring rotation off a speed control.
  peelRings?:       boolean   // meridianDraw choreography: rings lean together, then peel off one at a time into the ball (default false → the simultaneous staggered cascade)
  ringSeed?:        number    // offsets each ring's final random orientation, so the same figure can re-pose into a different ball per section (default 0)
  ringDots?:        boolean   // anchor ONE dot to each ring (not the rim); every ring tumbles. Used by the industries figure.
  solidRings?:      boolean   // ring-dot mode: stroke the rings as solid complete outlines instead of the default short dashes (default false)
  ringOrbit?:       number    // ring-dot mode: push each ring's CENTRE out radially by this fraction of min(W,H) (×0.18), fanned + idly spun, so the rings spread into a "rose" at 1 and gather into one coincident rim at 0 (default 0)
  activeRing?:      number    // ring index held flat & still (facing the viewer) while the others keep orbiting; -1/undefined = none
  spinDriver?:      number    // ring-dot mode: a continuous index (e.g. the fractional active industry). Each unit it changes adds a subtle, same-direction globe turn, so switching sections reads as emphasis (on top of the idle spin)
  flatHalo?:        number    // ring-dot mode: 0-1 strength of a flat screen-plane circle drawn around the whole ring group — a perfect circumference encircling the tilted globe
  ringDotColors?:   (string | null)[] // per-ring dot colour (by ring index); null → neutral fallback
  ringDotScales?:   (number | null)[] // per-ring dot size multiplier (by ring index), eased; null → 1
  onDotPositions?:  (positions: { x: number; y: number }[]) => void // per-frame ring-dot screen coords (ring-dot mode) so the page can park DOM labels
  dotSize?:         number   // diameter in px
  uniformDots?:     boolean  // skip the per-dot perspective size scaling so every dot renders at the same radius regardless of depth (default false)
  dotScale?:        number   // extra size multiplier on the flat main dots only (not the overlay glow); default 1
  dotStagger?:      number   // degrees of per-rail phase offset (rail i gets -i·dotStagger), desynchronizing
                             // the dots' shared oscillation. Applied to BOTH the dot and its rolling inner
                             // circle, so each dot stays on its circle's rim. 0 = all dots in unison (default).
                             // Geometry note (n rails): circle centres sit at -i·(360/n + stagger), so they
                             // stay EVENLY spread only when stagger is a multiple of 360/n. With 6 rails,
                             // -120 → even 60° circle spread + dots in three phase groups (0/120/240°);
                             // avoid 60 exactly (antipodal dots merge). Non-multiples trade even circle
                             // spacing for more distinct per-dot phases.
  speed?:           number   // 1-100 → omega = value/50
  trailSize?:       number   // frames, 0 = off
  circleSize?:      number   // percent of min(W,H), 10-90
  railSpacing?:     number   // degrees between adjacent rails; 0/unset = automatic
                             // (360/n, or 180/n with phase). Used by the mobile nav to
                             // cluster the dots on a small arc of an oversized rim.
  xOffset?:         number   // px, horizontal shift of the figure center (clamped on-screen)
  clampXOffset?:    boolean  // default true. false lets xOffset push the centre fully
                             // off-screen (mobile nav rim cropped at the right edge).
  yOffset?:         number   // percent of viewport height; raises (+) / lowers (−) the figure center
  restPhase?:       number   // degrees — orbital phase the figure eases to when stopped (speed 0)
  settle?:          boolean  // when true, ease the orbital phase to restPhase instead of free-spinning
  circleColor?:     string   // stroke color for the circle/ring outlines (default backgroundTertiary)
  circleColorFade?: { from: string; fadeVh: number } | null // scroll crossfade: rims start at `from`
                             // at the top and settle to circleColor over fadeVh (mirrors baseColorFade)
  dotColors?:       (string | null)[] // per-rail override (by colorIndex); null → neutral fallback
  dotScales?:       (number | null)[] // per-rail size multiplier (by colorIndex), eased; null → 1. Used to grow the hovered nav dot.
  // Single-canvas hero compositing (intro only). When `background` is set the
  // canvas paints opaque (faded out by scroll) so the dots can blend against it;
  // `heroText` draws the intro copy in-canvas above the outlines, below the dots;
  // `dotBlendMode` composites the main dot fills over everything beneath them.
  background?:      string | null
  heroText?:        HeroTextContent | null
  // The "what we do" sticky sentences, painted in-canvas one at a time as the
  // `selector` section scrolls (same compositing as heroText). Reveal is driven
  // off that section's rect via the shared stickyTiming windows.
  scrollText?:      ScrollTextContent | null
  // When true, the hero text + scroll sentences are drawn fully-formed (no
  // per-character scramble / scale-in). They still appear/fade with scroll.
  staticText?:      boolean
  dotBlendMode?:    GlobalCompositeOperation
  // A second pass of the same dots drawn on top of the main dots with its own
  // shades / blend / size / trail, faded out by the scroll-out. Used in the
  // intro to layer hard-light "glow" dots over the plain original dots.
  overlayDots?:     OverlayDots | null
  // Intro-only colours for the base dots that crossfade to the default palette
  // on scroll (so the intro can recolour a dot without a hard swap elsewhere).
  baseColorFade?:   BaseColorFade | null
  className?:       string
  // Forces the canvas backing-store pixel ratio (overriding the device-DPR
  // cap) so the figure can be re-rendered at an exact multiple of its CSS box
  // for high-resolution image export. null/undefined → normal device DPR (≤2).
  exportPixelRatio?: number | null
}

export type ScrollTextContent = { sentences: string[]; selector: string }

export type BaseColorFade = {
  colors: (string | null)[]  // per-rail intro colours (null → default); fade toward the default palette
  fadeVh: number             // viewport fraction of scroll over which the crossfade completes
  // Optional second-stage recolour: once the dots are on the default palette,
  // crossfade the listed rails to a new target as `selector` scrolls from the
  // bottom (75% of viewport) to the centre — matching the S1→S2 trigger window.
  shift?: {
    selector: string
    colors: (string | null)[] // per-rail target (null → leave on the default palette)
  }
}

export type OverlayDots = {
  colors:      (string | null)[]        // per-rail (by colorIndex); null → neutral
  blendMode:   GlobalCompositeOperation
  sizeMul:     number                   // multiplier on the main dot radius
  trailFrames: number                   // overlay trail length, independent of main
  fadeVh:      number                   // viewport fraction of scroll over which it fades out
  minShrink?:  number                   // floor for the current dots' scale/opacity (0 = vanish fully, default; e.g. 0.5 keeps them half-size)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TusiAnimation({
  numRails        = 2,
  circleSize      = 100,
  railSpacing     = 0,
  xOffset         = 0,
  clampXOffset    = true,
  speed           = 100,
  dotSize         = 24,
  uniformDots     = false,
  dotScale        = 1,
  dotStagger      = 0,
  trailSize       = 24,
  draw            = 0,
  tilt            = 0,
  rotation        = 0,
  pan             = 0,
  restTilt        = 0,
  restPan         = 0,
  yOffset         = 0,
  showOuter       = false,
  showInner       = false,
  showRails       = false,
  phase           = false,
  overlap         = true,
  showConnections = false,
  showCrown       = false,
  crownDensity    = 20,
  meridians       = 0,
  meridianSpread  = 360,
  meridianDraw    = 100,
  showIntersections = true,
  spinRings       = false,
  uniformSpin     = false,
  ringSpinScale   = 1,
  peelRings       = false,
  ringSeed        = 0,
  ringDots        = false,
  solidRings      = false,
  ringOrbit       = 0,
  activeRing      = -1,
  spinDriver      = 0,
  flatHalo        = 0,
  ringDotColors,
  ringDotScales,
  onDotPositions,
  restPhase       = 0,
  settle          = false,
  circleColor     = CIRCLE_COLOR,
  circleColorFade = null,
  dotColors,
  dotScales,
  background      = null,
  heroText        = null,
  scrollText      = null,
  staticText      = false,
  dotBlendMode    = 'source-over',
  overlayDots     = null,
  baseColorFade   = null,
  className,
  exportPixelRatio = null,
}: TusiAnimationProps) {

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportPixelRatioRef = useRef(exportPixelRatio)
  const applyResizeRef = useRef<() => void>(() => {})

  // Target refs — updated instantly when props change
  const numRailsRef        = useRef(numRails)
  const showOuterRef       = useRef(showOuter)
  const showInnerRef       = useRef(showInner)
  const showRailsRef       = useRef(showRails)
  const phaseRef           = useRef(phase)
  const overlapRef         = useRef(overlap)
  const tiltRef            = useRef(tilt)
  const rotationRef        = useRef(rotation)
  const panRef             = useRef(pan)
  const restTiltRef        = useRef(restTilt)
  const restPanRef         = useRef(restPan)
  const drawRef            = useRef(draw)
  const showConnectionsRef = useRef(showConnections)
  const showCrownRef       = useRef(showCrown)
  const crownDensityRef    = useRef(crownDensity)
  const meridiansRef       = useRef(meridians)
  const meridianSpreadRef  = useRef(meridianSpread)
  const meridianDrawRef    = useRef(meridianDraw)
  const showIntersectionsRef = useRef(showIntersections)
  const spinRingsRef       = useRef(spinRings)
  const uniformSpinRef     = useRef(uniformSpin)
  const ringSpinScaleRef   = useRef(ringSpinScale)
  const peelRingsRef       = useRef(peelRings)
  const solidRingsRef      = useRef(solidRings)
  const ringOrbitRef       = useRef(ringOrbit)
  const ringSeedRef        = useRef(ringSeed)
  const ringDotsRef        = useRef(ringDots)
  const activeRingRef      = useRef(activeRing)
  const spinDriverRef      = useRef(spinDriver)
  const flatHaloRef        = useRef(flatHalo)
  const ringDotColorsRef   = useRef(ringDotColors)
  const ringDotScalesRef   = useRef(ringDotScales)
  const onDotPositionsRef  = useRef(onDotPositions)
  const uniformDotsRef     = useRef(uniformDots)
  const ringFlattenRef     = useRef<number[]>([]) // per-ring eased highlight amount
  const dotSizeRef         = useRef(dotSize)
  const dotScaleRef        = useRef(dotScale)
  const dotStaggerRef      = useRef(dotStagger)
  const speedRef           = useRef(speed)
  const trailSizeRef       = useRef(trailSize)
  const circleSizeRef      = useRef(circleSize)
  const railSpacingRef     = useRef(railSpacing)
  const xOffsetRef         = useRef(xOffset)
  const clampXOffsetRef    = useRef(clampXOffset)
  const yOffsetRef         = useRef(yOffset)
  const restPhaseRef       = useRef(restPhase)
  const settleRef          = useRef(settle)
  const circleColorRef     = useRef(circleColor)
  // The prop value, kept separately from circleColorRef: when a fade is
  // active the draw loop rewrites circleColorRef per frame from this base.
  const circleColorBaseRef = useRef(circleColor)
  const circleColorFadeRef = useRef(circleColorFade)
  const dotColorsRef       = useRef(dotColors)
  const dotScalesRef       = useRef(dotScales)
  const backgroundRef      = useRef(background)
  const heroTextRef        = useRef(heroText)
  const scrollTextRef      = useRef(scrollText)
  const staticTextRef      = useRef(staticText)
  const dotBlendModeRef    = useRef(dotBlendMode)
  const overlayDotsRef     = useRef(overlayDots)
  const baseColorFadeRef   = useRef(baseColorFade)

  // Animated current refs — lerped toward target each frame
  const tiltAnimRef       = useRef(tilt)
  const rotationAnimRef   = useRef(rotation)
  const panAnimRef        = useRef(pan)
  const dotSizeAnimRef    = useRef(dotSize)
  const dotScaleAnimRef   = useRef(dotScale)
  // Per-rail (by colorIndex) eased hover-size multipliers, so the hovered nav
  // dot grows/shrinks smoothly rather than snapping.
  const dotHoverScaleRef  = useRef<number[]>([])
  const speedAnimRef      = useRef(speed)
  const trailSizeAnimRef  = useRef(trailSize)
  const circleSizeAnimRef = useRef(circleSize)
  const xOffsetAnimRef    = useRef(xOffset)
  const yOffsetAnimRef    = useRef(yOffset)

  useEffect(() => { numRailsRef.current        = numRails        }, [numRails])
  useEffect(() => { showOuterRef.current       = showOuter       }, [showOuter])
  useEffect(() => { showInnerRef.current       = showInner       }, [showInner])
  useEffect(() => { showRailsRef.current       = showRails       }, [showRails])
  useEffect(() => { phaseRef.current           = phase           }, [phase])
  useEffect(() => { overlapRef.current         = overlap         }, [overlap])
  useEffect(() => { tiltRef.current            = tilt            }, [tilt])
  useEffect(() => { rotationRef.current        = rotation        }, [rotation])
  useEffect(() => { panRef.current             = pan             }, [pan])
  useEffect(() => { restTiltRef.current         = restTilt        }, [restTilt])
  useEffect(() => { restPanRef.current          = restPan         }, [restPan])
  useEffect(() => { drawRef.current            = draw            }, [draw])
  useEffect(() => { showConnectionsRef.current = showConnections }, [showConnections])
  useEffect(() => { showCrownRef.current       = showCrown       }, [showCrown])
  useEffect(() => { crownDensityRef.current     = crownDensity     }, [crownDensity])
  useEffect(() => { meridiansRef.current        = meridians        }, [meridians])
  useEffect(() => { meridianSpreadRef.current   = meridianSpread   }, [meridianSpread])
  useEffect(() => { meridianDrawRef.current     = meridianDraw     }, [meridianDraw])
  useEffect(() => { showIntersectionsRef.current = showIntersections }, [showIntersections])
  useEffect(() => { spinRingsRef.current        = spinRings        }, [spinRings])
  useEffect(() => { uniformSpinRef.current       = uniformSpin      }, [uniformSpin])
  useEffect(() => { ringSpinScaleRef.current     = ringSpinScale    }, [ringSpinScale])
  useEffect(() => { solidRingsRef.current        = solidRings       }, [solidRings])
  useEffect(() => { ringOrbitRef.current          = ringOrbit        }, [ringOrbit])
  useEffect(() => { peelRingsRef.current        = peelRings        }, [peelRings])
  useEffect(() => { ringSeedRef.current         = ringSeed         }, [ringSeed])
  useEffect(() => { ringDotsRef.current         = ringDots         }, [ringDots])
  useEffect(() => { activeRingRef.current       = activeRing       }, [activeRing])
  useEffect(() => { spinDriverRef.current        = spinDriver        }, [spinDriver])
  useEffect(() => { flatHaloRef.current          = flatHalo          }, [flatHalo])
  useEffect(() => { ringDotColorsRef.current    = ringDotColors    }, [ringDotColors])
  useEffect(() => { ringDotScalesRef.current    = ringDotScales    }, [ringDotScales])
  useEffect(() => { onDotPositionsRef.current   = onDotPositions   }, [onDotPositions])
  useEffect(() => { uniformDotsRef.current       = uniformDots      }, [uniformDots])
  useEffect(() => { dotSizeRef.current         = dotSize         }, [dotSize])
  useEffect(() => { dotScaleRef.current        = dotScale        }, [dotScale])
  useEffect(() => { dotStaggerRef.current      = dotStagger      }, [dotStagger])
  useEffect(() => { speedRef.current           = speed           }, [speed])
  useEffect(() => { trailSizeRef.current       = trailSize       }, [trailSize])
  useEffect(() => { restPhaseRef.current        = restPhase        }, [restPhase])
  useEffect(() => { settleRef.current            = settle           }, [settle])
  useEffect(() => { circleColorRef.current       = circleColor; circleColorBaseRef.current = circleColor }, [circleColor])
  useEffect(() => { circleColorFadeRef.current   = circleColorFade  }, [circleColorFade])
  useEffect(() => { dotColorsRef.current         = dotColors        }, [dotColors])
  useEffect(() => { dotScalesRef.current        = dotScales        }, [dotScales])
  useEffect(() => { circleSizeRef.current      = circleSize      }, [circleSize])
  useEffect(() => { railSpacingRef.current     = railSpacing     }, [railSpacing])
  useEffect(() => { xOffsetRef.current         = xOffset         }, [xOffset])
  useEffect(() => { clampXOffsetRef.current    = clampXOffset    }, [clampXOffset])
  useEffect(() => { yOffsetRef.current         = yOffset         }, [yOffset])
  useEffect(() => { backgroundRef.current      = background      }, [background])
  useEffect(() => { heroTextRef.current         = heroText        }, [heroText])
  useEffect(() => { scrollTextRef.current        = scrollText      }, [scrollText])
  useEffect(() => { staticTextRef.current        = staticText      }, [staticText])
  useEffect(() => { dotBlendModeRef.current     = dotBlendMode     }, [dotBlendMode])
  useEffect(() => { overlayDotsRef.current      = overlayDots      }, [overlayDots])
  useEffect(() => { baseColorFadeRef.current    = baseColorFade    }, [baseColorFade])

  // Re-rasterise at the requested export pixel ratio (then back) on change.
  useEffect(() => {
    exportPixelRatioRef.current = exportPixelRatio
    applyResizeRef.current()
  }, [exportPixelRatio])

  // ── Animation loop (mounts once, reads refs each frame) ───────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let rafId: number
    let W = 0, H = 0, dpr = 1
    const maxDpr = 2

    // Apply the canvas backing-store size from its CSS box. Assigning
    // canvas.width/height *clears the bitmap*, so bail when the rounded
    // device-pixel dims are unchanged — even a same-value assignment flashes.
    function applyResize() {
      if (!canvas) return
      // exportPixelRatio (when set) overrides the device-DPR cap so the figure
      // can be rasterised at an exact multiple of its CSS box for export.
      dpr = exportPixelRatioRef.current ?? Math.min(window.devicePixelRatio || 1, maxDpr)
      const rect = canvas.getBoundingClientRect()
      const pxW  = Math.round(rect.width * dpr)
      const pxH  = Math.round(rect.height * dpr)
      W = rect.width; H = rect.height
      if (pxW === canvas.width && pxH === canvas.height) return
      canvas.width  = pxW
      canvas.height = pxH
    }
    applyResizeRef.current = applyResize

    // iOS Safari changes the layout-viewport height continuously as the URL bar
    // collapses/expands during scroll. Honoring every change reallocates (and
    // blanks) the bitmap each frame → the scroll flicker. So: react to width
    // changes immediately (orientation / real layout), but debounce height-only
    // changes until scrolling settles, reallocating just once.
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const ro = new ResizeObserver(() => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (resizeTimer) clearTimeout(resizeTimer)
      if (Math.abs(rect.width - W) > 1) {
        applyResize()
      } else {
        resizeTimer = setTimeout(applyResize, 200)
      }
    })
    ro.observe(canvas)
    applyResize()

    // Seed every progress from its current target so the first frame matches
    // the props — otherwise hardcoded 1s here cause a brief outline flash on
    // mount when the prop is actually 0 (e.g. homepage state has draw=0).
    let overlapProgress      = overlapRef.current       ? 1 : 0
    let phaseProgress        = phaseRef.current         ? 1 : 0
    let outerProgress        = showOuterRef.current     ? 1 : 0
    let innerProgress        = showInnerRef.current     ? 1 : 0
    let railsProgress        = showRailsRef.current     ? 1 : 0
    let connectionsProgress  = showConnectionsRef.current ? 1 : 0
    let crownProgress        = showCrownRef.current     ? 1 : 0
    let drawProgress         = drawRef.current / 100
    let lastT = 0

    // Hero text (single-canvas compositing): laid out lazily and cached by a
    // size+content key; `heroActiveT` stamps when the copy first becomes active
    // so the reveal is time-driven; defer drawing until web fonts are ready so
    // the glyphs don't flash in a fallback face.
    let heroLayout: HeroTextLayout | null = null
    let heroLayoutSig = ''
    let heroActiveT   = -1
    let fontsReady    = false

    // Scroll sentences: layouts cached by size+content; one reveal clock per
    // sentence (advanced while active, rewound otherwise → reversible scramble);
    // lastFrameT gives the per-frame dt that drives those clocks.
    let sentenceLayouts: SentenceLayout[] = []
    let sentenceSig = ''
    let sentenceRevealT: number[] = []
    // One-way scale clock: advances while a sentence is active so it settles
    // (1.2 → 1.0) on the way in, holds while it scrambles out, and only resets
    // once the sentence is fully gone — so the fade-out never scales back up.
    let sentenceScaleT: number[] = []
    let lastFrameT = -1
    // Explicitly load the exact faces the hero text uses (TribeSerif Book 400,
    // TribeCaption Regular 400) so the canvas never paints a fallback frame —
    // canvas can only use faces already in the document's font set.
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([
        document.fonts.load('400 60px "TribeSerif"'),
        document.fonts.load('400 14px "TribeCaption"'),
      ]).then(() => { fontsReady = true }).catch(() => { fontsReady = true })
    }

    let dotProgress  = 1
    let prevDotState = '0-0'
    type Pt = { x: number; y: number }
    let frozenDots:        Pt[]   = []
    let lastDots:          Pt[]   = []
    let trailHistory:      Pt[][] = []
    let ringDotTrailHistory: Pt[][] = []
    let centerTrailHistory:Pt[][] = []
    let overlayTrailHistory:Pt[][] = []

    let phi          = 0  // accumulated phase angle — incremented by omega*delta each frame
    // Accumulated uniform globe-spin angle (ring-dot figure). Advanced by a gated
    // RATE each frame so it never sweeps through many turns when the gate drops —
    // unlike `t·settle`, which unwound a large absolute angle to 0 on collapse and
    // span the figure many times into the CTA. As the ball flattens it eases to the
    // nearest flat orientation by the SHORTEST path (one short rotation to flat).
    let ringSpin     = 0
    // Last spinDriver (fractional active index) — each unit it moves feeds a subtle,
    // same-direction emphasis turn into ringSpin (abs, so scrolling either way turns
    // the same way). Seeded on the first frame so loading mid-scroll doesn't lurch.
    let prevSpinDriver: number | null = null
    let rails:       RailState[] = []
    let prevN        = -1
    let prevUsePhase = false
    let prevSpacing  = -1
    const RAIL_SPEED = 6
    // Overlay only belongs to the 2-rail intro stages; once more rails roll in
    // (S2+), this eases to 0 so none of those extra dots carry the overlay.
    let overlayGate  = 1

    function easeInOut(x: number) {
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    }
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
    // Crossfade between the intro base colours and the default palette, 0 at the
    // top (intro colours) → 1 once scrolled past the fade window (set per frame).
    let baseColorMix = 1
    // Second-stage recolour progress: 0 until `shift.selector` reaches the bottom
    // of the viewport, 1 once it hits centre (set per frame).
    let shiftMix = 0
    // Per-rail color: a dotColors override (nav) wins; otherwise crossfade the
    // intro base colours toward the default palette, then (optionally) shift the
    // listed rails to a second-stage target as the next section scrolls in.
    function colorFor(i: number) {
      const override = dotColorsRef.current
      if (override) return override[i] ?? DOT_COLOR_FALLBACK
      const def = dotColor(i)
      const bcf = baseColorFadeRef.current
      let c = def
      if (bcf && baseColorMix < 1) {
        const intro = bcf.colors[i] ?? def
        c = baseColorMix <= 0 ? intro : mixHex(intro, def, baseColorMix)
      }
      const shiftTo = bcf?.shift?.colors[i]
      if (shiftTo && shiftMix > 0) {
        c = shiftMix >= 1 ? shiftTo : mixHex(c, shiftTo, shiftMix)
      }
      return c
    }

    function draw(timestamp: number) {
      const t     = timestamp / 1000
      const delta = lastT === 0 ? 0 : Math.min(t - lastT, 0.1)
      lastT = t

      const n             = numRailsRef.current
      const usePhase      = phaseRef.current
      const overlapTarget = overlapRef.current ? 1 : 0
      const phaseTarget   = usePhase ? 1 : 0
      const outerTarget        = showOuterRef.current       ? 1 : 0
      const innerTarget        = showInnerRef.current       ? 1 : 0
      const railsTarget        = showRailsRef.current       ? 1 : 0
      const connectionsTarget  = showConnectionsRef.current ? 1 : 0
      const crownTarget        = showCrownRef.current       ? 1 : 0

      // Lerp numeric values toward their targets
      const numericLerp = Math.min(1, delta * 6)
      tiltAnimRef.current       = lerp(tiltAnimRef.current,       tiltRef.current,       numericLerp)
      rotationAnimRef.current   = lerp(rotationAnimRef.current,   rotationRef.current,   numericLerp)
      panAnimRef.current        = lerp(panAnimRef.current,        panRef.current,        numericLerp)
      dotSizeAnimRef.current    = lerp(dotSizeAnimRef.current,    dotSizeRef.current,    numericLerp)
      dotScaleAnimRef.current   = lerp(dotScaleAnimRef.current,   dotScaleRef.current,   numericLerp)
      // Ease each rail's hover-size multiplier (by colorIndex) toward its target
      // (1 when not hovered) so the hovered nav dot grows/shrinks smoothly.
      {
        const targets = dotScalesRef.current
        const cur = dotHoverScaleRef.current
        const hoverLerp = Math.min(1, delta * 12)
        const count = Math.max(cur.length, targets?.length ?? 0)
        for (let i = 0; i < count; i++) {
          cur[i] = lerp(cur[i] ?? 1, targets?.[i] ?? 1, hoverLerp)
        }
      }
      speedAnimRef.current      = lerp(speedAnimRef.current,      speedRef.current,      numericLerp)
      trailSizeAnimRef.current  = lerp(trailSizeAnimRef.current,  trailSizeRef.current,  numericLerp)
      circleSizeAnimRef.current = lerp(circleSizeAnimRef.current, circleSizeRef.current, numericLerp)
      xOffsetAnimRef.current    = lerp(xOffsetAnimRef.current,    xOffsetRef.current,    numericLerp)
      yOffsetAnimRef.current    = lerp(yOffsetAnimRef.current,    yOffsetRef.current,    numericLerp)

      const maxTrail      = Math.round(trailSizeAnimRef.current)
      const omega         = speedAnimRef.current / 50
      const TAU           = Math.PI * 2

      // `settle` (set the moment the nav opens) eases the orbital phase to a
      // defined angle (restPhase, degrees) on the nearest turn, concurrently
      // with the rest of the morph — so the figure rotates to rest *during* the
      // transition rather than after it. Otherwise it free-spins via omega.
      if (settleRef.current) {
        const restRad = (restPhaseRef.current * Math.PI) / 180
        const rest = Math.round((phi - restRad) / TAU) * TAU + restRad
        // Settle rate 6 (was 4): dots land on their resting angles fast enough
        // for the nav labels' earlier fade-in to anchor to them.
        phi = lerp(phi, rest, Math.min(1, delta * 6))
      } else {
        phi += omega * delta
      }
      // Expose the live orbital angle (degrees, 0–360) for tuning restPhase.
      ;(window as unknown as { __tusiPhase?: number }).__tusiPhase =
        Math.round((((phi % TAU) + TAU) % TAU) * 180 / Math.PI)

      // Rolling off: full circle (2π/n) so diameters overlap on even n.
      // Rolling on: half-circle (π/n) so all N lines are visually distinct.
      // railSpacing (degrees) overrides the automatic spread — used by the
      // mobile nav to cluster the dots on a small arc of an oversized rim.
      const spacing = railSpacingRef.current > 0
        ? (railSpacingRef.current * Math.PI) / 180
        : (usePhase ? Math.PI / n : TAU / n)

      if (n !== prevN) {
        const active = rails.filter(r => !r.dying)
        const keep   = Math.min(active.length, n)
        const newActive: RailState[] = []

        // Existing rails animate to their new evenly-spaced positions
        for (let i = 0; i < keep; i++) {
          newActive.push({ ...active[i], targetAngle: -i * spacing, dying: false, targetAlpha: 1, colorIndex: i })
        }
        // New rails normally start at 0° and animate to their position. On the
        // very first build, though, seed them already at their target angle so
        // no rail swings around on the intro's first frame — otherwise that
        // settling rotation fights the orbital phase and the dot appears to
        // briefly reverse direction before settling.
        const firstBuild = prevN === -1
        for (let i = keep; i < n; i++) {
          const target = -i * spacing
          // Seed stagger like angle: at its target on the first build (no swing
          // when loading mid-scroll), from 0 otherwise (eases in below).
          const stagTarget = -i * (dotStaggerRef.current * Math.PI) / 180
          newActive.push({ angle: firstBuild ? target : 0, targetAngle: target, alpha: 0, targetAlpha: 1, dying: false, colorIndex: i, stagger: firstBuild ? stagTarget : 0 })
        }

        const stillDying = rails.filter(r => r.dying)
        for (let i = n; i < active.length; i++) {
          stillDying.push({ ...active[i], targetAlpha: 0, dying: true })
        }

        rails        = [...newActive, ...stillDying]
        prevN        = n
        prevUsePhase = usePhase
        trailHistory       = []
        centerTrailHistory = []
        frozenDots         = []
        dotProgress        = 1
      } else if (usePhase !== prevUsePhase || spacing !== prevSpacing) {
        // Re-target on a spacing change too (railSpacing flips with the nav),
        // so rails ease to the new spread even when the count is unchanged.
        rails.filter(r => !r.dying).forEach((rail, i) => {
          rail.targetAngle = -i * spacing
        })
        prevUsePhase = usePhase
      }
      prevSpacing = spacing

      // Animate rails
      // Stagger eases gently (slower than the rail fan) so a state's new offset
      // blooms in over ~a second; the shortest-path wrap means each rail travels
      // to the NEAREST equivalent angle (≤180°) rather than unwinding -i·stagger
      // literally — which would whirl the back rails through multiple turns.
      const STAG_SPEED = 2
      const stagRad = (dotStaggerRef.current * Math.PI) / 180
      for (let i = 0; i < rails.length; i++) {
        const rail = rails[i]
        let diff = rail.targetAngle - rail.angle
        diff -= TAU * Math.round(diff / TAU)
        rail.angle += diff * Math.min(1, delta * RAIL_SPEED)
        let sdiff = (-i * stagRad) - rail.stagger
        sdiff -= TAU * Math.round(sdiff / TAU)
        rail.stagger += sdiff * Math.min(1, delta * STAG_SPEED)
        rail.alpha   = rail.targetAlpha > rail.alpha
          ? Math.min(rail.targetAlpha, rail.alpha + delta * RAIL_SPEED)
          : Math.max(rail.targetAlpha, rail.alpha - delta * RAIL_SPEED)
      }
      rails = rails.filter(r => !(r.dying && r.alpha < 0.005))

      // Animate shared progress values
      const advance = (v: number, target: number) =>
        target > v ? Math.min(target, v + delta * 4) : Math.max(target, v - delta * 4)

      overlapProgress     = advance(overlapProgress,     overlapTarget)
      phaseProgress       = advance(phaseProgress,       phaseTarget)
      outerProgress       = advance(outerProgress,       outerTarget)
      innerProgress       = advance(innerProgress,       innerTarget)
      railsProgress       = advance(railsProgress,       railsTarget)
      connectionsProgress = advance(connectionsProgress, connectionsTarget)
      // Crown uses a slower speed so the stagger effect is visible
      crownProgress = crownTarget > crownProgress
        ? Math.min(crownTarget, crownProgress + delta * 2)
        : Math.max(crownTarget, crownProgress - delta * 2)
      // Draw progress animates more slowly for a deliberate reveal feel
      const drawTarget = drawRef.current / 100
      drawProgress = drawTarget > drawProgress
        ? Math.min(drawTarget, drawProgress + delta * 2)
        : Math.max(drawTarget, drawProgress - delta * 2)

      const p            = easeInOut(overlapProgress)
      const phaseP       = easeInOut(phaseProgress)
      const outerP       = easeInOut(outerProgress)
      const innerP       = easeInOut(innerProgress)
      const railsP       = easeInOut(railsProgress)
      const connectionsP = easeInOut(connectionsProgress)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // ── Single-canvas hero compositing ──────────────────────────────────────
      // Scroll-out progress drives both the background fade and the text outro,
      // mirroring the DOM outro (#home: top top → 20% top): 0 at the top, 1 once
      // scrolled ~20vh. Both only engage while hero props are supplied.
      const bgColor     = backgroundRef.current
      const heroContent = heroTextRef.current
      const scrollY     = typeof window !== 'undefined' ? window.scrollY : 0
      // Hold the intro cover fully visible for the first HERO_HOLD_VH of scroll,
      // THEN fade over the next HERO_FADE_VH. (Previously it began fading from the
      // first pixel of scroll — no hold.) Both fractions are of viewport height,
      // so the hold is the same feel on mobile and desktop. The background fade
      // rides the same clock; the S0→S1 figure morph is delayed to match (see the
      // '#what-we-do' trigger in AnimationController).
      const HERO_HOLD_VH = 0.3
      const HERO_FADE_VH = 0.2
      const outro = (bgColor || heroContent)
        ? Math.min(1, Math.max(0, (scrollY - H * HERO_HOLD_VH) / (H * HERO_FADE_VH)))
        : 0

      // Base-dot colour crossfade: 0 at the top (intro colours) → 1 past the
      // fade window (default palette), eased so the recolour isn't abrupt.
      const bcf = baseColorFadeRef.current
      if (bcf) {
        const cp = Math.min(1, scrollY / (H * Math.max(0.01, bcf.fadeVh)))
        baseColorMix = cp * cp * (3 - 2 * cp) // smoothstep
        // Second-stage shift: 0 when shift.selector's top is at 75% of the
        // viewport, 1 once it reaches centre (50%) — the S1→S2 window.
        if (bcf.shift && typeof document !== 'undefined') {
          const el = document.querySelector(bcf.shift.selector)
          if (el) {
            const top = el.getBoundingClientRect().top
            const sp  = Math.max(0, Math.min(1, (H * 0.75 - top) / (H * 0.25)))
            shiftMix  = sp * sp * (3 - 2 * sp) // smoothstep
          } else {
            shiftMix = 0
          }
        }
      } else {
        baseColorMix = 1
      }

      // Rim-colour crossfade: linework starts at `from` at the top and settles
      // to the circleColor prop over fadeVh of scroll (same windowing as the
      // base-dot fade above). Runs before any stroke this frame, so every
      // circleColorRef consumer picks up the mixed shade.
      const ccf = circleColorFadeRef.current
      if (ccf) {
        const rp = Math.min(1, scrollY / (H * Math.max(0.01, ccf.fadeVh)))
        const rm = rp * rp * (3 - 2 * rp) // smoothstep
        const base = circleColorBaseRef.current
        circleColorRef.current =
          rm <= 0 ? ccf.from : rm >= 1 ? base : mixHex(ccf.from, base, rm)
      } else {
        circleColorRef.current = circleColorBaseRef.current
      }

      // Opaque background painted in screen space (before the figure's rotate).
      // Stays fully opaque — it doesn't occlude the page because the canvas drops
      // behind <main> (z-auto) as soon as isAbove flips on scroll, and at the top
      // it's the full-screen hero anyway. Keeping it opaque gives the hard-light
      // overlay a constant light backdrop (otherwise it darkens as the bg fades).
      if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, W, H)
      }

      // Vertical shift of the figure center: positive raises it (toward the top),
      // expressed as a percent of viewport height so it scales across screens.
      // On mobile, lift the intro figure ~5% of H so it sits more optically
      // centred on the tall phone viewport (matches the heading's intro rise in
      // heroCanvasText). Tie it to (1 - outro) so it eases back to dead-centre as
      // the cover fades on scroll — no snap into the #what-we-do morph. Desktop
      // and every scrolled state are unaffected.
      const introRise = W < MOBILE_BLEED_MAX_W ? 0.05 * H * (1 - outro) : 0
      const cy      = H / 2 - (yOffsetAnimRef.current / 100) * H - introRise
      const R       = Math.min(W, H) * (circleSizeAnimRef.current / 100)

      // Horizontal drift is applied to the drawing center (not a CSS translate on
      // the wrapper) so the canvas always covers the full viewport — no transparent
      // gap on the leading edge, and one coordinate system shared with tilt/rotation.
      // Clamp the magnitude so the figure keeps a consistent ~0.4·R max overscan per
      // edge on any aspect ratio: desktop drift is preserved, but on a narrow/portrait
      // screen the offset shrinks instead of shoving the figure off-screen.
      // clampXOffset=false (mobile nav rim) lets the centre travel fully
      // off-screen so only a cropped arc of an oversized circle stays visible.
      const reqOffset = xOffsetAnimRef.current
      // On a narrow (mobile) screen the ~0.6·R pad otherwise pulls the rightward
      // #model shift back toward centre. There we deliberately want the figure
      // pushed far right and bleeding off the right edge (a cropped arc reads as
      // intentional on the background canvas), so relax the pad for rightward
      // (positive) offsets on mobile only. Leftward shifts (#partners) and every
      // desktop width keep the tighter pad that guarantees the whole figure stays
      // on-screen.
      const rightBleedMobile = W < MOBILE_BLEED_MAX_W && reqOffset > 0
      const clampPad  = rightBleedMobile ? 0.1 : 0.6
      const maxOffset = clampXOffsetRef.current ? Math.max(0, W / 2 - R * clampPad) : Infinity
      const cx        = W / 2 + Math.sign(reqOffset) * Math.min(Math.abs(reqOffset), maxOffset)

      // Z-axis rotation applied as a canvas transform so all drawing rotates
      const rotZrad = (rotationAnimRef.current * Math.PI) / 180
      if (rotZrad !== 0) {
        ctx.translate(cx, cy)
        ctx.rotate(rotZrad)
        ctx.translate(-cx, -cy)
      }

      const focal   = Math.min(W, H) * 1.5
      const tiltRad = (tiltAnimRef.current * Math.PI) / 180
      const panRad  = (panAnimRef.current * Math.PI) / 180
      const dotR    = dotSizeAnimRef.current / 2

      // Shared 3D-rotation trig: every point is rotated about the X-axis (tilt,
      // tipping toward the camera) then the Y-axis (pan, turning left/right),
      // then perspective-projected by `focal`.
      const cosTilt = Math.cos(tiltRad), sinTilt = Math.sin(tiltRad)
      const cosPan  = Math.cos(panRad),  sinPan  = Math.sin(panRad)
      const noRot   = tiltRad === 0 && panRad === 0

      function project(x: number, y: number): [number, number] {
        if (noRot) return [x, y]
        const dx = x - cx, dy = y - cy
        const yT = dy * cosTilt          // rotateX: depth zT below
        const zT = dy * sinTilt
        const x2 =  dx * cosPan + zT * sinPan   // rotateY about the tilted depth
        const z2 = -dx * sinPan + zT * cosPan
        const s  = focal / Math.max(1, focal - z2)
        return [cx + x2 * s, cy + yT * s]
      }
      function pscale(x: number, y: number) {
        if (noRot) return 1
        const dx = x - cx, dy = y - cy
        const z2 = -dx * sinPan + dy * sinTilt * cosPan
        return focal / Math.max(1, focal - z2)
      }
      function strokeCircle(x0: number, y0: number, r: number, startAngle = 0, segs = 80) {
        const endSeg = Math.round(segs * drawProgress)
        if (endSeg < 1) return
        ctx.beginPath()
        for (let j = 0; j <= endSeg; j++) {
          const a = startAngle + (j / segs) * TAU
          const [px, py] = project(x0 + r * Math.cos(a), y0 + r * Math.sin(a))
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        if (drawProgress >= 1) ctx.closePath()
        ctx.stroke()
      }
      // A great-circle "meridian": the main circle (radius R, centered cx,cy)
      // rotated about the horizontal X-axis by `rho` radians, then perspective-
      // projected. rho = tiltRad reproduces the main outline exactly; adding a
      // spread angle fans copies into a wireframe sphere (all rings share the
      // left/right poles). Always a full ring — these are persistent outlines,
      // not part of the draw-on sweep that strokeCircle handles.
      // Project a point at polar (r, theta) on a meridian ring tumbled by a per-ring
      // rotation about the vertical Y-axis (phiY) AND the horizontal X-axis (phiX),
      // then tipped by the shared X-tilt. phiX = phiY = 0 reproduces the main outline;
      // advancing both per ring tumbles the rings into a fuller 3D ball rather than
      // sharing a single pole axis.
      // Transform order per point: ring orientation RotY(phiY)→RotX(phiX), then a
      // `spin`, then the camera RotX(camTilt)→RotY(pan). camTilt/pan are per-ring so
      // the rings can parallax against each other on the mouse offset. spin=0 → the
      // static ball.
      //   • default: spin about the object Z-axis (the main ring's normal — the SAME
      //     axis the orbiting dots travel around, so the sphere rotates like the dots
      //     do). Reads as a flat in-plane spin (homepage tusi).
      //   • globe=true: spin about the vertical Y-axis instead, so the wireframe
      //     turns like a globe in 3D (rings sweeping toward/away in depth) under the
      //     camera X-tilt. Used by the industries ring-dot figure.
      function projMeridian(phiX: number, phiY: number, r: number, theta: number, camTilt: number, pan: number, spin: number, offX = 0, offY = 0, globe = false): [number, number] {
        const ox = r * Math.cos(theta)
        const oy = r * Math.sin(theta)
        // ring orientation — RotY(phiY) then RotX(phiX)
        const x0 =  ox * Math.cos(phiY)
        const z0 = -ox * Math.sin(phiY)
        const cphi = Math.cos(phiX), sphi = Math.sin(phiX)
        const y1 = oy * cphi - z0 * sphi
        const z1 = oy * sphi + z0 * cphi
        const cs = Math.cos(spin), ss = Math.sin(spin)
        let x2: number, y2: number, zSpin: number
        if (globe) {
          // globe spin about the vertical Y-axis (rotates x & z, leaves y) → a 3D turn
          x2    =  x0 * cs + z1 * ss
          zSpin = -x0 * ss + z1 * cs
          y2    =  y1
        } else {
          // sphere spin about object-Z (matches the dots' orbit axis)
          x2    = x0 * cs - y1 * ss
          y2    = x0 * ss + y1 * cs
          zSpin = z1
        }
        // camera tilt — RotX(camTilt)
        const ct = Math.cos(camTilt), st = Math.sin(camTilt)
        const y3 = y2 * ct - zSpin * st
        const z3 = y2 * st + zSpin * ct
        // camera pan — RotY(pan)
        const cp = Math.cos(pan), sp = Math.sin(pan)
        const x4 =  x2 * cp + z3 * sp
        const z4 = -x2 * sp + z3 * cp  // depth → perspective scale
        const s  = focal / Math.max(1, focal - z4)
        return [cx + offX + x4 * s, cy + offY + y3 * s]
      }
      function strokeMeridian(phiX: number, phiY: number, camTilt: number, pan: number, spin: number, segs = 80, offX = 0, offY = 0, globe = false) {
        ctx.beginPath()
        for (let j = 0; j <= segs; j++) {
          const [px, py] = projMeridian(phiX, phiY, R, (j / segs) * TAU, camTilt, pan, spin, offX, offY, globe)
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }
      function strokeLine(x1: number, y1: number, x2: number, y2: number) {
        if (drawProgress <= 0) return
        // Grow from the midpoint outward in both directions simultaneously
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
        const ex1 = mx + (x1 - mx) * drawProgress
        const ey1 = my + (y1 - my) * drawProgress
        const ex2 = mx + (x2 - mx) * drawProgress
        const ey2 = my + (y2 - my) * drawProgress
        const [px1, py1] = project(ex1, ey1)
        const [px2, py2] = project(ex2, ey2)
        ctx.beginPath()
        ctx.moveTo(px1, py1); ctx.lineTo(px2, py2)
        ctx.stroke()
      }
      function fillDot(x: number, y: number, color: string, sizeFactor = 1, target: CanvasRenderingContext2D = ctx) {
        const r = dotR * sizeFactor * (uniformDotsRef.current ? 1 : pscale(x, y))
        if (r <= 0) return
        const [px, py] = project(x, y)
        target.beginPath()
        target.arc(px, py, r, 0, TAU)
        target.fillStyle = color
        target.fill()
      }

      // ── Circles ─────────────────────────────────────────────────────────────
      ctx.strokeStyle = circleColorRef.current
      ctx.lineWidth   = 0.5

      const numMeridians = Math.round(meridiansRef.current)

      // When the wireframe sphere is active, its k=0 ring IS the main outline (and
      // owns the dotted→solid style), so skip the plain swept outer circle to avoid
      // double-drawing. Otherwise (S2+) draw the outer circle as before.
      if (outerP > 0.005 && numMeridians <= 1) {
        ctx.globalAlpha = outerP
        strokeCircle(cx, cy, R)
        ctx.globalAlpha = 1
      }

      // ── Wireframe sphere meridians ────────────────────────────────────────────
      // N full outline rings tumbled into a 3D ball. k=0 lands on the main outline;
      // each extra ring gets a fixed pseudo-random rotation on BOTH the X and Y axes
      // (stable per ring via hashRand, bounded by meridianSpread). We draw all N here
      // so the full figure shows even at rest (draw:0, where strokeCircle's swept
      // outline is absent). Gated by outerP.
      if (numMeridians > 1 && outerP > 0.005) {
        // spread = magnitude of each extra ring's final random rotation (full at
        // rest, →0 on scroll to converge on the main ring). meridianDraw is the
        // entrance progress: each ring eases (rotate + fade) from collapsed to its
        // final position in a staggered cascade, so the intro reads smooth/simple.
        const REST_SPREAD = 360               // spread at rest (matches S0)
        const FULL_RAD    = (REST_SPREAD * Math.PI) / 180
        const p           = Math.max(0, Math.min(1, meridianDrawRef.current / 100))
        const numExtra    = numMeridians - 1
        const S           = 0.6  // fraction of the entrance used to spread the starts

        // Convergence factor for the scroll-out: as spread drops 360→0 the rings
        // should rotate back + fade EARLY, finishing once spread reaches 40% of
        // rest (~60% through the S0→S1 scroll) so they're gone before the camera
        // settles. 1 at rest/intro (spread constant), 0 once converged.
        const convT  = Math.max(0, Math.min(1,
          (meridianSpreadRef.current / REST_SPREAD - 0.4) / 0.6))
        const formed = p * p * (3 - 2 * p)            // entrance smoothstep
        const settle = convT * formed                 // fully formed & not converging
        // Scroll-out in two beats: first the rings rotate back to ALIGN with the main
        // ring (rotF: 1→0 over convT 1→0.5) while staying visible, then they fade out
        // (alphaF: 1→0 over convT 0.5→0). So they line up before disappearing.
        const rotF   = Math.max(0, Math.min(1, (convT - 0.5) / 0.5))
        const alphaF = Math.max(0, Math.min(1, convT / 0.5))

        // Uniform globe spin (ring-dot figure) advanced as an ACCUMULATED angle:
        // add a settle-gated rate each frame so it holds (never unwinds) when the
        // gate drops. As the ball flattens (`formed`→0 on the collapse into the CTA)
        // ease the angle to the nearest flat orientation by the SHORTEST path, so the
        // figure makes ONE short rotation to flat instead of spinning through every
        // turn it had accumulated. Non-uniform spin (homepage) keeps its t·settle.
        if (spinRingsRef.current && uniformSpinRef.current) {
          ringSpin += 0.11 * settle * delta
          // Section-change emphasis: each step the active industry moves turns the
          // globe a little extra — SIGNED, so scrolling forward winds it one way and
          // scrolling back UP reverses (retraces) the same turn rather than piling on
          // more forward rotation. Gated by `settle` so it only fires once the ball is
          // formed. ~0.9 rad ≈ 50° per industry step.
          const sd = spinDriverRef.current
          if (prevSpinDriver !== null) ringSpin += 0.9 * (sd - prevSpinDriver) * settle
          prevSpinDriver = sd
          const flat = 1 - formed
          if (flat > 0.02) {
            const nearest = Math.round(ringSpin / TAU) * TAU
            ringSpin += (nearest - ringSpin) * Math.min(1, delta * 5 * flat)
          }
        }

        // Mouse offset from the resting pose. Each ring parallaxes against it at a
        // slightly different pace (gated by `settle`, so the intro/scroll motion
        // stays uniform — only the resting mouse-look diverges per ring).
        const tiltDeltaRad = ((tiltAnimRef.current - restTiltRef.current) * Math.PI) / 180
        const panDeltaRad  = ((panAnimRef.current  - restPanRef.current)  * Math.PI) / 180
        const PACE_AMP     = 0.9

        // Precompute every ring's rotation + per-ring camera tilt/pan once, so the
        // drawing and the intersection math use exactly the same positions.
        type Ring = { phiX: number; phiY: number; mTilt: number; mPan: number; spin: number; vis: number }
        const rings: Ring[] = []
        // Ring-dot mode: every ring (incl. the main one) tumbles and carries a dot,
        // and the active industry's ring eases to flat & still while the rest orbit.
        const ringDotsOn = ringDotsRef.current
        const activeRing  = activeRingRef.current ?? -1
        // Per-ring highlight amount (1 = full, dims toward 0). With no active ring
        // (the overview) every ring stays full; with one active, the rest fade back.
        const emph = ringFlattenRef.current
        // Per-ring highlight amount: eases to 1 for the active ring (rest toward
        // 0) so the highlighted ring/dot reads brighter while the others dim.
        // Eased slowly so the highlight glides rather than snapping.
        const HILITE_EASE = 1.8 // lower = slower highlight in/out
        for (let k = 0; k < numMeridians; k++) {
          const tgt = activeRing < 0 ? 1 : k === activeRing ? 1 : 0
          emph[k] = (emph[k] ?? 1) + (tgt - (emph[k] ?? 1)) * Math.min(1, delta * HILITE_EASE)
        }
        for (let k = 0; k < numMeridians; k++) {
          let phiX = 0, phiY = 0, vis = 1, pace = 1, spin = 0
          if (k > 0 || ringDotsOn) {
            const seed = Math.round(ringSeedRef.current)
            const fX = hashRand(k * 2     + seed * 31) * FULL_RAD  // this ring's final orientation
            const fY = hashRand(k * 2 + 1 + seed * 31) * FULL_RAD
            if (ringDotsOn) {
              // Each ring opens out of the flat plane as the ball forms, then holds
              // its pose and spins. Use a CENTERED, BOUNDED orientation (±GLOBE_OPEN
              // on each axis) rather than the raw [0,2π) random: an unbounded angle
              // near 2π would spin a ring almost all the way around to reach a pose
              // that's barely off flat — so the overview→industry handoff read as
              // "too many rotations". Centering keeps every ring's opening a SHORT
              // turn and the dots close to their overview slots.
              const GLOBE_OPEN = (100 * Math.PI) / 180
              const gX = (hashRand(k * 2     + seed * 31) * 2 - 1) * GLOBE_OPEN
              const gY = (hashRand(k * 2 + 1 + seed * 31) * 2 - 1) * GLOBE_OPEN
              phiX = gX * formed
              phiY = gY * formed
              vis  = alphaF
            } else if (peelRingsRef.current) {
              // Peel choreography: the whole bundle leans together, then rings
              // detach ONE AT A TIME, each easing out to its own final angle —
              // calmer than the simultaneous cascade. `formed` is the eased
              // formation progress (0 grouped/flat → 1 full ball); whoever drives
              // meridianDraw owns the ease-in-out over the section.
              const GROUP_PHASE = 0.12                 // all rings lean together first
              const PEEL_DUR    = 0.22                 // each ring's own peel-out span
              const GROUP_LEAN  = (24 * Math.PI) / 180 // shared bundle lean before peeling
              const peelSpan = Math.max(1e-3, 1 - GROUP_PHASE - PEEL_DUR)
              const step     = numExtra > 1 ? peelSpan / (numExtra - 1) : 0
              const gLean    = GROUP_LEAN * formed     // bundle leans as the section forms
              const relStart = GROUP_PHASE + (k - 1) * step
              const peel     = Math.max(0, Math.min(1, (formed - relStart) / PEEL_DUR))
              const peelE    = peel * peel * (3 - 2 * peel)  // ease each ring's peel-out
              // before release the ring rides the group lean; during/after it
              // eases to its own final. No rotF here — the peel owns formation,
              // so the ball stays full per section instead of flattening as the
              // per-industry spread dips.
              phiX = gLean * (1 - peelE) + fX * peelE
              phiY = 0     * (1 - peelE) + fY * peelE
              vis  = alphaF                            // visible throughout — the ball persists
            } else {
              const start = ((k - 1) / numExtra) * S
              const local = Math.max(0, Math.min(1, (p - start) / (1 - S)))
              const eIn   = local * local * (3 - 2 * local)  // staggered entrance
              const rot   = eIn * rotF                        // rotation magnitude (aligns out first)
              vis  = eIn * alphaF                             // opacity (fades out after aligning)
              phiX = fX * rot
              phiY = fY * rot
            }
            // uniformSpin: every ring shares ONE pace + ONE spin, so the whole
            // set rotates rigidly together (a 3D group turning as one) instead of
            // each ring drifting at its own rate.
            pace = uniformSpinRef.current ? 1 : 1 + PACE_AMP * (hashRand(k * 9 + 5) * 2 - 1)
            // Slow continuous spin about the main ring's axis (like the orbiting
            // dots). Gated by settle so the intro entrance / scroll-converge stay
            // clean.
            if (spinRingsRef.current) {
              if (uniformSpinRef.current) {
                // Globe turn (vertical-axis spin in projMeridian): slow, clearly 3D,
                // identical for every ring so the wireframe rotates rigidly as a ball.
                // Accumulated above so collapsing to the CTA is one short flatten.
                spin = ringSpin
              } else {
                const nuance = 0.85 + 0.3 * hashRand(k * 11 + 7) // ~0.85–1.15×
                spin = t * 0.15 * nuance * settle * ringSpinScaleRef.current
              }
            }
          }
          const mTilt = tiltRad + (pace - 1) * tiltDeltaRad * settle
          const mPan  = panRad  + (pace - 1) * panDeltaRad  * settle
          rings.push({ phiX, phiY, vis, spin, mTilt, mPan })
        }

        // Ring-dot "rose" offset: push each ring's centre out radially (fanned
        // evenly, idly spun) by ringOrbit. At 1 the rings spread into the rose; at
        // 0 they all sit on one coincident rim — so the SAME rings carry the
        // intro, the overview and (as they rotate open via formed) the highlight,
        // with no second element and no hand-off.
        const orbitR = ringDotsOn ? ringOrbitRef.current * Math.min(W, H) * 0.18 : 0
        const roseSpin = t * 0.07
        const ringOffX = (k: number) =>
          orbitR === 0 ? 0 : orbitR * Math.cos((k / numMeridians) * TAU - Math.PI / 2 + roseSpin)
        const ringOffY = (k: number) =>
          orbitR === 0 ? 0 : orbitR * Math.sin((k / numMeridians) * TAU - Math.PI / 2 + roseSpin)

        // main outline (k=0): dotted at rest like the extra rings, then animates
        // back to the original solid 0.5px hairline on scroll-out (as convT→0).
        // In ring-dot mode there is no special main ring — every ring is equal.
        // Mobile: thin the intro's dashed outline so the hairline reads finer on
        // small screens. Scoped to the default non-ring-dot figure (the intro
        // cover) via !ringDotsOn, so the industries rose / model figures are
        // untouched. Applied to both the main outline and the extra rings below.
        const outlineThin = !ringDotsOn && W < 768 ? 0.7 : 1
        if (!ringDotsOn) {
          const r0 = rings[0]
          const solidify = 1 - convT
          ctx.globalAlpha = outerP
          ctx.lineWidth   = (0.8 + (0.5 - 0.8) * solidify) * outlineThin   // 0.8 → 0.5
          if (solidify >= 0.999) {
            ctx.setLineDash([])
            ctx.lineCap = 'butt'
          } else {
            ctx.lineCap = 'round'
            ctx.setLineDash([2, 4 * (1 - solidify)])       // gap closes → solid
          }
          strokeMeridian(r0.phiX, r0.phiY, r0.mTilt, r0.mPan, r0.spin)
        }

        // extra rings: 0.8px short dashes, staggered ease-in, early converge-out
        // (ring-dot mode draws ALL rings here, including k=0). The active ring is
        // drawn a touch heavier so the highlighted industry's ring reads clearly.
        // solidRings strokes them as complete solid outlines instead (no dashes),
        // so the figure reads as a clean continuous outline rather than dashed.
        if (solidRingsRef.current) {
          ctx.lineCap = 'butt'
          ctx.setLineDash([])
        } else {
          ctx.lineCap   = 'round'
          ctx.setLineDash([2, 4])
        }
        // Ring-dot figure rotates like a globe (vertical-axis spin in projMeridian).
        const globe = ringDotsOn
        // When an industry is highlighted, the non-active rings switch to a DOTTED
        // style rather than just fading. Each ring is drawn in two crossfaded passes
        // by its eased emphasis `e`: a SOLID pass weighted by e (the active ring) and
        // a DOTTED pass weighted by (1−e) (the inactive rings), so solid↔dotted glides
        // smoothly as the highlight transfers between industries. No active ring (the
        // overview) → every ring stays solid (the clean constellation).
        const ringDotHighlight = ringDotsOn && activeRing >= 0
        // The extra rings (k>0) are visible when fanned out as the rose OR while
        // the ball is forming — but at the gathered overview (orbit 0, formed 0)
        // they fade to nothing so only the base ring (k=0) remains: a SINGLE clean
        // rim. So one set of rings reads as the rose, then the rim, then the ball,
        // all parametrically, with no second element and no stacked-ring jump.
        const extraVis = Math.max(formed, ringOrbitRef.current)
        for (let k = ringDotsOn ? 0 : 1; k < numMeridians; k++) {
          const rg = rings[k]
          if (rg.vis <= 0.001) continue
          const e = ringDotsOn ? (emph[k] ?? 1) : 1
          const strokeVis = ringDotsOn && k > 0 ? rg.vis * extraVis : rg.vis
          if (strokeVis <= 0.001) continue
          const baseAlpha = outerP * strokeVis
          if (ringDotHighlight) {
            // Solid pass — fades up on the active ring (e→1). Same 0.8 hairline the
            // homepage model-section figure strokes its rings with (the highlight
            // reads through solid-vs-dotted + the dot, not a heavier stroke).
            if (e > 0.002) {
              ctx.setLineDash([])
              ctx.lineCap   = 'butt'
              ctx.globalAlpha = baseAlpha * e
              ctx.lineWidth = 0.8
              strokeMeridian(rg.phiX, rg.phiY, rg.mTilt, rg.mPan, rg.spin, 80, ringOffX(k), ringOffY(k), globe)
            }
            // Dotted pass — the inactive rings, stroked in the SAME neutral shade and
            // SAME 0.8 hairline as the active ring; only the dotted style sets them apart.
            const de = 1 - e
            if (de > 0.002) {
              ctx.setLineDash([0.5, 5])
              ctx.lineCap   = 'round'
              ctx.globalAlpha = baseAlpha * de
              ctx.lineWidth = 0.8
              strokeMeridian(rg.phiX, rg.phiY, rg.mTilt, rg.mPan, rg.spin, 80, ringOffX(k), ringOffY(k), globe)
            }
          } else {
            ctx.globalAlpha = baseAlpha * (0.14 + 0.86 * e)
            ctx.lineWidth = (0.8 + 0.5 * e) * outlineThin
            strokeMeridian(rg.phiX, rg.phiY, rg.mTilt, rg.mPan, rg.spin, 80, ringOffX(k), ringOffY(k), globe)
          }
        }
        // reset so crown / other strokes stay solid hairlines
        ctx.setLineDash([])
        ctx.lineCap   = 'butt'
        ctx.lineWidth = 0.5
        ctx.globalAlpha = 1

        // ── Ring-anchored dots ────────────────────────────────────────────────
        // One dot per ring, spread around the ball (θ per ring) and riding its
        // ring's pose. Non-active dots fade with their ring. Each dot's screen
        // position is reported so the page can park a DOM label on it.
        if (ringDotsOn) {
          const rdColors = ringDotColorsRef.current
          const rdScales = ringDotScalesRef.current
          const positions: { x: number; y: number }[] = []
          // Composite the ring dots with the caller's dotBlendMode — the same
          // blend the homepage uses for its resting coloured dots (multiply), so
          // the accent dots read richly against the light page rather than as
          // flat opaque fills.
          ctx.globalCompositeOperation = dotBlendModeRef.current
          // Ring-dot trails: faded copies of recent positions (same palette
          // colour / per-ring fade as the live dot), drawn first so the current
          // dots sit on top. Driven by the shared trail length (trailSize).
          if (maxTrail > 0 && ringDotTrailHistory.length > 1) {
            const total = ringDotTrailHistory.length
            for (let f = 0; f < total - 1; f++) {
              const age = (total - 1 - f) / total
              const a   = Math.pow(1 - age, 2) * 0.9
              const frame = ringDotTrailHistory[f]
              for (let k = 0; k < frame.length && k < numMeridians; k++) {
                const rg = rings[k]
                if (!rg || rg.vis <= 0.001) continue
                const e = emph[k] ?? 1
                const r = dotR * (rdScales?.[k] ?? 1)
                if (r <= 0) continue
                ctx.globalAlpha = a * outerP * rg.vis * e * e
                ctx.beginPath()
                ctx.arc(frame[k].x, frame[k].y, r, 0, TAU)
                ctx.fillStyle = rdColors?.[k] ?? DOT_COLOR_FALLBACK
                ctx.fill()
              }
            }
            ctx.globalAlpha = 1
          }
          for (let k = 0; k < numMeridians; k++) {
            const rg = rings[k]
            // Every dot sits at its fixed slot on its ring and simply RIDES the
            // constant group rotation (rg.spin). No per-dot path creep — that used
            // absolute time, so a freshly-activated dot would snap far around its
            // ring (the "weird spin" on industry switches). The dots are already
            // in motion via the group, so locking in reads smooth.
            const theta = (k / numMeridians) * TAU
            const [px, py] = projMeridian(rg.phiX, rg.phiY, R, theta, rg.mTilt, rg.mPan, rg.spin, ringOffX(k), ringOffY(k), true)
            positions[k] = { x: px, y: py }
            if (rg.vis <= 0.001) continue
            const e = emph[k] ?? 1
            const r = dotR * (rdScales?.[k] ?? 1)
            if (r <= 0) continue
            // Inactive dots FADE OUT while a section is highlighted (emph e→0); the
            // overview (no active ring) keeps every dot at full alpha (e=1), as does
            // the active dot. e² so the fade resolves decisively (the highlight ease
            // is gentle, so a linear e would leave the others lingering faintly).
            ctx.globalAlpha = outerP * rg.vis * e * e
            ctx.beginPath()
            ctx.arc(px, py, r, 0, TAU)
            ctx.fillStyle = rdColors?.[k] ?? DOT_COLOR_FALLBACK
            ctx.fill()
          }
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          // Record this frame's dot positions for the trail (capped to length).
          if (maxTrail > 0) {
            ringDotTrailHistory.push(positions.map((p) => ({ x: p.x, y: p.y })))
            if (ringDotTrailHistory.length > maxTrail) {
              ringDotTrailHistory = ringDotTrailHistory.slice(ringDotTrailHistory.length - maxTrail)
            }
          } else {
            ringDotTrailHistory = []
          }
          onDotPositionsRef.current?.(positions)
        }

        // ── Flat halo ──────────────────────────────────────────────────────────
        // A perfect screen-plane circle encircling the whole ring group (no tilt /
        // projection) — a flat circumference that wraps the tilted globe while a
        // section is highlighted. Strength via flatHalo; shares the rim colour.
        const halo = flatHaloRef.current
        if (ringDotsOn && halo > 0.001) {
          ctx.save()
          ctx.setLineDash([])
          ctx.lineCap = 'butt'
          ctx.strokeStyle = circleColorRef.current
          ctx.lineWidth = 0.8
          ctx.globalAlpha = outerP * halo
          ctx.beginPath()
          ctx.arc(cx, cy, R * 1.07, 0, TAU)
          ctx.stroke()
          ctx.restore()
        }

        // ── Intersection dots ──────────────────────────────────────────────────
        // A dot at every ring–ring crossing: two great circles meet at ±R·(nᵢ×nⱼ)
        // where nᵢ is each ring's plane normal in camera space — computed from the
        // SAME per-ring tilt/pan as the drawn rings, so dots stay on the crossings
        // even as the rings parallax. Only shown once the ball has settled.
        const dotsP = formed * alphaF
        if (showIntersectionsRef.current && dotsP > 0.01) {
          const normals: [number, number, number][] = rings.map((rg) => {
            const ax = rg.mTilt + rg.phiX
            const a  = Math.sin(rg.phiY)
            const b  = -Math.cos(rg.phiY) * Math.sin(ax)
            const c  =  Math.cos(rg.phiY) * Math.cos(ax)
            const cP = Math.cos(rg.mPan), sP = Math.sin(rg.mPan)
            return [a * cP + c * sP, b, -a * sP + c * cP]
          })

          ctx.fillStyle = circleColorRef.current
          const baseDot = 1.8
          for (let i = 0; i < numMeridians; i++) {
            for (let j = i + 1; j < numMeridians; j++) {
              const ni = normals[i], nj = normals[j]
              let dx = ni[1] * nj[2] - ni[2] * nj[1]
              let dy = ni[2] * nj[0] - ni[0] * nj[2]
              let dz = ni[0] * nj[1] - ni[1] * nj[0]
              const len = Math.hypot(dx, dy, dz)
              if (len < 1e-4) continue   // (near-)coincident rings → no crossing
              dx /= len; dy /= len; dz /= len
              for (let sgn = 1; sgn >= -1; sgn -= 2) {
                const X = sgn * R * dx, Y = sgn * R * dy, Z = sgn * R * dz
                const s = focal / Math.max(1, focal - Z)
                ctx.globalAlpha = outerP * dotsP
                ctx.beginPath()
                ctx.arc(cx + X * s, cy + Y * s, baseDot * s, 0, TAU)
                ctx.fill()
              }
            }
          }
          ctx.globalAlpha = 1
        }
      }

      // ── Crown ────────────────────────────────────────────────────────────────
      // n*2 radial lines outside the main circle, staggered in/out.
      // S = stagger fraction: fraction of crownProgress used for stagger delay.
      if (crownProgress > 0) {
        const numCrown = n * Math.max(1, Math.round(crownDensityRef.current))
        const S        = 0.5  // 50% of animation time is the stagger spread

        ctx.strokeStyle = circleColorRef.current
        ctx.lineWidth   = 0.5

        for (let i = 0; i < numCrown; i++) {
          const theta = (i / numCrown) * TAU

          // Per-line progress: forward stagger when on, reverse when off
          let localP: number
          if (crownTarget === 1) {
            const start = (i / numCrown) * S
            localP = Math.max(0, Math.min(1, (crownProgress - start) / (1 - S)))
          } else {
            // Reverse order: last line drawn is first to disappear
            const reverseI = numCrown - 1 - i
            const start    = (reverseI / numCrown) * S
            const eraseP   = 1 - crownProgress
            localP = 1 - Math.max(0, Math.min(1, (eraseP - start) / (1 - S)))
          }

          if (localP <= 0) continue

          // Line grows from circle edge outward by up to 10% of R
          const [px1, py1] = project(cx + R * Math.cos(theta), cy + R * Math.sin(theta))
          const [px2, py2] = project(
            cx + R * (1 + 0.1 * localP) * Math.cos(theta),
            cy + R * (1 + 0.1 * localP) * Math.sin(theta),
          )

          ctx.globalAlpha = localP
          ctx.beginPath()
          ctx.moveTo(px1, py1)
          ctx.lineTo(px2, py2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // Overlap fade factor — shared by rails and inner circles
      const innerAlpha = Math.max(0, 1 - p / 0.6)

      // Diameter lines — gated only by railsP, independent of innerP
      if (railsP > 0.005 && innerAlpha > 0) {
        for (const rail of rails) {
          const a = railsP * innerAlpha * rail.alpha
          if (a < 0.005) continue
          ctx.globalAlpha = a
          strokeLine(cx + R * Math.cos(rail.angle), cy + R * Math.sin(rail.angle),
                     cx - R * Math.cos(rail.angle), cy - R * Math.sin(rail.angle))
        }
        ctx.globalAlpha = 1
      }

      // Inner rolling circles — gated by innerP. Rail i's circle is phase-shifted
      // by the same eased rail.stagger as its dot (see the dots loop below), so
      // the dot stays exactly on this circle's rim while the rails desynchronize.
      if (innerP > 0.005 && innerAlpha > 0) {
        const innerR = lerp(R / 2, R, p)

        for (const rail of rails) {
          const a = innerP * innerAlpha * (1 - phaseP) * rail.alpha
          if (a < 0.005) continue
          ctx.globalAlpha = a
          const icx0 = cx + (R / 2) * Math.cos(phi + rail.stagger + rail.angle)
          const icy0 = cy + (R / 2) * Math.sin(phi + rail.stagger + rail.angle)
          const icxD = lerp(icx0, cx, p)
          const icyD = lerp(icy0, cy, p)
          strokeCircle(icxD, icyD, innerR, Math.atan2(cy - icyD, cx - icxD))
        }

        const rollAlpha = innerP * innerAlpha * phaseP
        if (rollAlpha > 0.005) {
          ctx.globalAlpha = rollAlpha
          // The rails fan to negative angles (targetAngle = -i*spacing), so the
          // single Tusi rolling circle must orbit at -phi for every dot to lie
          // on its rim. At +phi it tracks the opposite side of the fan and
          // appears to roll against the dots.
          const icx0 = cx + (R / 2) * Math.cos(-phi)
          const icy0 = cy + (R / 2) * Math.sin(-phi)
          const icxD = lerp(icx0, cx, p)
          const icyD = lerp(icy0, cy, p)
          strokeCircle(icxD, icyD, innerR, Math.atan2(cy - icyD, cx - icxD))
        }
        ctx.globalAlpha = 1
      }

      // ── Dots ────────────────────────────────────────────────────────────────
      const dotState = `${overlapTarget}-${phaseTarget}`
      if (dotState !== prevDotState) {
        frozenDots   = lastDots.length === rails.length ? [...lastDots] : []
        dotProgress  = 0
        prevDotState = dotState
        trailHistory = []
      }
      dotProgress = Math.min(1, dotProgress + delta * 4)
      const dotP  = easeInOut(dotProgress)

      const newDots: Pt[] = []
      for (let i = 0; i < rails.length; i++) {
        const rail  = rails[i]
        const theta = rail.angle
        const phase = usePhase ? theta : 0
        // Per-rail phase offset (dotStagger, eased in the rails loop above):
        // desynchronizes the dots' shared oscillation. Mirrored in the rolling-
        // circle centres, so each dot keeps riding its own circle's rim.
        const stag  = rail.stagger

        let tx: number, ty: number
        if (overlapTarget === 1) {
          tx = cx + R * Math.cos(phi + stag + theta)
          ty = cy + R * Math.sin(phi + stag + theta)
        } else {
          tx = cx + R * Math.cos(phi + stag + phase) * Math.cos(theta)
          ty = cy + R * Math.cos(phi + stag + phase) * Math.sin(theta)
        }

        let x: number, y: number
        if (dotProgress >= 1 || frozenDots.length !== rails.length) {
          x = tx; y = ty
        } else {
          x = lerp(frozenDots[i].x, tx, dotP)
          y = lerp(frozenDots[i].y, ty, dotP)
        }
        newDots.push({ x, y })
      }

      // ── Connections ─────────────────────────────────────────────────────────
      // Drawn here so lines can reference the now-initialised newDots array.
      const connLineAlpha = connectionsP * (1 - phaseP)
      if (connectionsP > 0.005) {
        // Orbit circle — grows from R/2 to 3R/4 as rolling turns on
        ctx.strokeStyle = circleColorRef.current
        ctx.lineWidth   = 0.5
        ctx.globalAlpha = connectionsP
        strokeCircle(cx, cy, (R / 2) * (1 + 0.5 * phaseP), 0)
        ctx.globalAlpha = 1

        // Lines from center dot → main dot, fade out with rolling
        if (connLineAlpha > 0.005) {
          for (let i = 0; i < rails.length; i++) {
            const rail = rails[i]
            const md   = newDots[i]
            if (!md) continue
            const icx = cx + (R / 2) * Math.cos(phi + rail.angle)
            const icy = cy + (R / 2) * Math.sin(phi + rail.angle)
            // Connecting line uses the neutral ring color, not the dot color,
            // at full opacity to match the outer lines' weight.
            ctx.strokeStyle = circleColorRef.current
            ctx.lineWidth   = 0.5
            ctx.globalAlpha = connLineAlpha * rail.alpha * drawProgress
            const [px1, py1] = project(icx, icy)
            const [px2, py2] = project(md.x, md.y)
            ctx.beginPath()
            ctx.moveTo(px1, py1)
            ctx.lineTo(px2, py2)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }
      }

      // Center dots (connections): at each inner circle's centre, half dot size
      const connLineAlpha2 = connectionsP * (1 - phaseP)
      const centerDots: Pt[] = rails.map(rail => ({
        x: cx + (R / 2) * Math.cos(phi + rail.angle),
        y: cy + (R / 2) * Math.sin(phi + rail.angle),
      }))

      if (maxTrail > 0) {
        trailHistory.push([...newDots])
        if (trailHistory.length > maxTrail) {
          trailHistory = trailHistory.slice(trailHistory.length - maxTrail)
        }
      } else {
        trailHistory = []
      }

      // Center dot trail — only accumulated when connections is active
      if (connectionsP > 0.005 && connLineAlpha2 > 0.005 && maxTrail > 0) {
        centerTrailHistory.push([...centerDots])
        if (centerTrailHistory.length > maxTrail) {
          centerTrailHistory = centerTrailHistory.slice(centerTrailHistory.length - maxTrail)
        }
      } else if (!showConnectionsRef.current) {
        centerTrailHistory = []
      }

      // ── Hero text — above the outlines/connections, below the dots ───────────
      // Drawn in screen space (drawHeroText resets the transform internally) so
      // it ignores the figure's tilt/rotate. Reveal is time-driven from when the
      // copy first became active; the outro is the shared scroll-out progress.
      if (heroContent && fontsReady) {
        if (heroActiveT < 0) heroActiveT = t
        const wantKey = `${W}x${H}|${heroContent.heading}|${heroContent.caption}`
        if (heroLayoutSig !== wantKey) {
          // Wrap the heading at the real <main> content width (container − px-10),
          // matching where the DOM heading wraps. Fall back to a sane width.
          // On mobile the column is cramped, so give the heading 10% more width.
          const mainEl = document.querySelector('main')
          const baseCw = mainEl ? mainEl.clientWidth - 80 : Math.min(W - 80, 1000)
          // Desktop: 0.9 narrows the column ~10% so the heading breaks a word
          // earlier. Mobile: widen 10% instead, since the column is cramped.
          const cw = W < 768 ? baseCw * 1.1 : baseCw * 0.9
          heroLayout = layoutHeroText(ctx, W, H, heroContent, cw)
          heroLayoutSig = wantKey
        }
        // staticText → fully-formed (large introElapsed skips the scramble +
        // scale-in); the scroll-out `outro` still fades it as you leave #home.
        const heroIntro = staticTextRef.current ? 999 : t - heroActiveT
        // Heading only here (block 0): it sits BELOW the coloured/overlay dots so
        // its large forms blend with them (the intended single-canvas look). The
        // caption is drawn separately AFTER the dots (see below) so the dots don't
        // wash the small label to grey — worst on mobile, where it rides nearer
        // the dot cluster.
        if (heroLayout) drawHeroText(ctx, heroLayout, dpr, heroIntro, outro, 0)
      } else if (!heroContent) {
        heroActiveT   = -1
        heroLayout    = null
        heroLayoutSig = ''
      }

      // ── Scroll sentences — same layer as the hero text (above outlines, below
      // dots), one shown at a time as `selector` scrolls. Which sentence is
      // active comes from the shared stickyTiming windows on that section's rect;
      // each sentence's reveal clock advances while active and rewinds otherwise,
      // so it scrambles in, holds, then scrambles out (reversible on scroll-up).
      const scrollContent = scrollTextRef.current
      const dt = lastFrameT < 0 ? 0 : Math.min(0.05, t - lastFrameT)
      lastFrameT = t
      if (scrollContent && fontsReady) {
        const el = document.querySelector(scrollContent.selector)
        const sig = `${W}x${H}|${scrollContent.sentences.join('|')}`
        if (sentenceSig !== sig) {
          const mainEl = document.querySelector('main')
          const cw = mainEl ? mainEl.clientWidth - 80 : Math.min(W - 80, 1000)
          // Wrap the scroll sentences in a narrower column than the full content
          // width, so each reads as a tighter centred block (more lines). The
          // last sentence gets a slightly wider column for a nicer line break.
          const sentenceW = Math.min(cw, W * 0.55, 720)
          const wideSentenceW = Math.min(cw, W * 0.62, 820)
          const last = scrollContent.sentences.length - 1
          sentenceLayouts = scrollContent.sentences.map((s, i) =>
            layoutSentence(ctx, W, H, s, i === last ? wideSentenceW : sentenceW),
          )
          sentenceRevealT = sentenceLayouts.map((_, i) => sentenceRevealT[i] ?? 0)
          sentenceScaleT = sentenceLayouts.map((_, i) => sentenceScaleT[i] ?? 0)
          sentenceSig = sig
        }
        if (el) {
          const p = regionProgress(el.getBoundingClientRect(), H)
          const ranges = sentenceRanges(sentenceLayouts.length)
          const isStatic = staticTextRef.current
          for (let i = 0; i < sentenceLayouts.length; i++) {
            const active = p >= ranges[i].in && p < ranges[i].out
            if (isStatic) {
              // Static: the sentence is fully-formed while its window is active,
              // hidden otherwise — no per-character scramble / scale-in.
              sentenceRevealT[i] = active ? SENTENCE_REVEAL_DUR : 0
              sentenceScaleT[i] = SENTENCE_SCALE_DUR
            } else {
              sentenceRevealT[i] = Math.max(0, Math.min(SENTENCE_REVEAL_DUR, sentenceRevealT[i] + (active ? dt : -dt)))
              // Scale settles forward while active; holds during the scramble-out;
              // resets only once the sentence is fully hidden, so re-entry replays it.
              if (active) sentenceScaleT[i] = Math.min(SENTENCE_SCALE_DUR, sentenceScaleT[i] + dt)
              else if (sentenceRevealT[i] <= 0) sentenceScaleT[i] = 0
            }
            if (sentenceRevealT[i] > 0) drawSentence(ctx, sentenceLayouts[i], dpr, sentenceRevealT[i], sentenceScaleT[i])
          }
        }
      } else if (!scrollContent) {
        sentenceLayouts = []
        sentenceSig = ''
      }

      // Main (original) dots — the flat colour base, drawn *below* the blended
      // overlay glow that follows. Reset to source-over via the trailing reset.
      ctx.globalCompositeOperation = dotBlendModeRef.current

      // Main dot trail
      if (maxTrail > 0 && trailHistory.length > 1) {
        const total = trailHistory.length
        for (let f = 0; f < total - 1; f++) {
          const age   = (total - 1 - f) / total
          const alpha = Math.pow(1 - age, 2) * 0.9
          const frame = trailHistory[f]
          for (let i = 0; i < frame.length && i < rails.length; i++) {
            ctx.globalAlpha = alpha * rails[i].alpha
            fillDot(frame[i].x, frame[i].y, colorFor(rails[i].colorIndex), dotScaleAnimRef.current)
          }
        }
        ctx.globalAlpha = 1
      }

      // Center dot trail (connections)
      if (connectionsP > 0.005 && centerTrailHistory.length > 1) {
        const total = centerTrailHistory.length
        for (let f = 0; f < total - 1; f++) {
          const age   = (total - 1 - f) / total
          const alpha = Math.pow(1 - age, 2) * 0.9
          const frame = centerTrailHistory[f]
          for (let i = 0; i < frame.length && i < rails.length; i++) {
            ctx.globalAlpha = alpha * rails[i].alpha * connLineAlpha2
            fillDot(frame[i].x, frame[i].y, circleColorRef.current, 0.5)
          }
        }
        ctx.globalAlpha = 1
      }

      // Main dots — `dotScale` shrinks just these flat dots (e.g. S1 brings them
      // down to the centre dot size); the overlay glow is unaffected.
      const mainScale = dotScaleAnimRef.current
      const hoverScales = dotHoverScaleRef.current
      // Ring-dot mode carries its own per-ring dots (drawn with the rings); skip
      // the rim dots entirely.
      if (!ringDotsRef.current) {
        for (let i = 0; i < newDots.length; i++) {
          ctx.globalAlpha = rails[i].alpha
          const hs = hoverScales[rails[i].colorIndex] ?? 1
          fillDot(newDots[i].x, newDots[i].y, colorFor(rails[i].colorIndex), mainScale * hs)
        }
      }

      // Center dots (connections, half size, fade with rolling) — neutral ring
      // tone, so only the main dots (which carry the hard-light overlay) keep
      // the blue/yellow palette.
      if (connectionsP > 0.005 && connLineAlpha2 > 0.005) {
        for (let i = 0; i < centerDots.length; i++) {
          ctx.globalAlpha = rails[i].alpha * connLineAlpha2
          fillDot(centerDots[i].x, centerDots[i].y, circleColorRef.current, 0.5)
        }
      }

      // ── Overlay glow dots ────────────────────────────────────────────────────
      // A blended pass of the same dots with their own shades, size and (longer)
      // trail — its own history buffer so the trail outlasts the main one. Each
      // circle is composited individually with the blend mode. Dissolves on its
      // own (longer, eased) scroll window: opacity, trail length and size all
      // shrink together over fadeVh so it melts away smoothly.
      const overlay   = overlayDotsRef.current
      const fadeP     = overlay ? Math.min(1, scrollY / (H * Math.max(0.01, overlay.fadeVh))) : 0
      const shrink    = 1 - fadeP * fadeP * (3 - 2 * fadeP) // 1 at top → 0 scrolled (smoothstep)
      // The trail recedes to nothing via `shrink`; the current dots only shrink
      // /fade down to `minShrink` so they persist instead of vanishing.
      const minShrink = overlay ? (overlay.minShrink ?? 0) : 0
      const dotShrink = minShrink + (1 - minShrink) * shrink
      const oSizeMul  = overlay ? overlay.sizeMul * dotShrink : 0
      // Fade the whole overlay out as soon as the figure leaves the 2-rail
      // intro stages (S2+ has more rails/dots — none should carry the overlay).
      overlayGate += ((n <= 2 ? 1 : 0) - overlayGate) * Math.min(1, delta * RAIL_SPEED)
      if (overlay && newDots.length && overlayGate > 0.002) {
        const oMax = Math.round(overlay.trailFrames * shrink)
        if (oMax > 0) {
          overlayTrailHistory.push([...newDots])
          if (overlayTrailHistory.length > oMax) {
            overlayTrailHistory = overlayTrailHistory.slice(overlayTrailHistory.length - oMax)
          }
        } else {
          overlayTrailHistory = []
        }
        const ocolor = (i: number) => overlay.colors[i] ?? DOT_COLOR_FALLBACK

        ctx.globalCompositeOperation = overlay.blendMode

        // Overlay trail — length and opacity driven by `shrink`, so the tail
        // shortens and fades off completely as you scroll.
        if (oMax > 0 && overlayTrailHistory.length > 1) {
          const total = overlayTrailHistory.length
          for (let f = 0; f < total - 1; f++) {
            const age   = (total - 1 - f) / total
            const alpha = Math.pow(1 - age, 2) * 0.9 * shrink * overlayGate
            const frame = overlayTrailHistory[f]
            for (let i = 0; i < frame.length && i < rails.length; i++) {
              ctx.globalAlpha = alpha * rails[i].alpha
              fillDot(frame[i].x, frame[i].y, ocolor(rails[i].colorIndex), oSizeMul)
            }
          }
        }
        // Overlay current dots — floored by `minShrink`, so they stay visible.
        for (let i = 0; i < newDots.length; i++) {
          ctx.globalAlpha = rails[i].alpha * dotShrink * overlayGate
          fillDot(newDots[i].x, newDots[i].y, ocolor(rails[i].colorIndex), oSizeMul)
        }
        ctx.globalAlpha = 1
      } else {
        overlayTrailHistory = []
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      lastDots = newDots

      // Caption lifted above the dots (block 1): the coloured/overlay dots blend
      // over the hero text, which washed the small caption to a grey — most
      // visible on mobile where the caption sits closer to the dot cluster.
      // Redrawing just the caption on top of every dot layer keeps it a solid,
      // dark label. The heading stayed below (drawn during the hero block).
      if (heroContent && fontsReady && heroLayout) {
        const heroIntroCap = staticTextRef.current ? 999 : t - heroActiveT
        drawHeroText(ctx, heroLayout, dpr, heroIntroCap, outro, 1)
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'absolute inset-0 w-full h-full'}
      style={{ willChange: 'transform' }}
    />
  )
}
