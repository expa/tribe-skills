// Intro "wash" animation for the article-cover generator.
//
// The static canvas draws every element at once. This drives a one-shot reveal
// where the artwork washes in across the frame: it starts as bare background,
// then dots pop in, and the lines connecting them draw right after — each
// element keyed to its radial distance from a chosen origin point (the wash
// spreads outward from there) plus a small per-TYPE offset so dots always lead
// their lines. The result reads as one soft front rippling out over the image.
//
// Timing + easing live here as pure helpers so NodeCanvas can compute a given
// element's local progress each frame (NodeCanvas owns the geometry, so it maps
// each element to its 0-1 sweep distance itself), and the controller (also here)
// owns the shared clock so every mounted canvas animates in lockstep off one rAF
// loop — no React re-render per frame.

/** Phases of the reveal, in ms. Total playback = lead + sweep + tail. */
export const ANIM = {
  /** Hold on pure background before anything appears — sells the "starts empty" beat. */
  leadMs: 260,
  /** The wash itself: the front travels across the frame and elements fade/pop in. */
  sweepMs: 2400,
  /** Let the last elements finish settling (and, on export, flush final frames). */
  tailMs: 480,
} as const;

/** Fraction of the normalised timeline the spatial front takes to cross the frame.
 *  < 1 so the trailing elements still have room to finish their fade before the end. */
const SWEEP_SPAN = 0.62;
/** Length of each element's own fade/pop window, in normalised timeline units. */
const FADE = 0.2;
/** Per-type head start (normalised). Dots lead; lines trail so they read as drawn
 *  onto already-placed dots; fills (background-like) come in underneath first. */
const TYPE_OFFSET = { fill: 0, dot: 0.05, line: 0.14 } as const;
export type AnimElement = keyof typeof TYPE_OFFSET;

/** Direction of the radial wash. 'out' = spreads outward from the origin (elements
 *  nearest it appear first); 'in' = converges from the frame edges toward the origin
 *  (elements farthest from it appear first). */
export type WashDirection = 'out' | 'in';

/** Max displacement (in normalised sweep units) a fully-dialled `jitter` applies to an
 *  element's arrival. Each element gets a stable per-element offset in ±this range, so
 *  the wash front breaks up organically instead of advancing as a perfect circle. */
export const JITTER_SPAN = 0.35;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Map a timeline position (ms from the start of the reveal) to sweep progress (0-1),
 *  using the same lead/sweep/tail phasing as live playback. Lets the offline
 *  image-sequence export step the reveal deterministically instead of off a clock. */
export function progressAtTime(ms: number): number {
  return clamp01((ms - ANIM.leadMs) / ANIM.sweepMs);
}

/** An element's local 0-1 progress given the global timeline position `g` (0-1),
 *  its sweep coordinate `s`, and its type. 0 = not yet visible, 1 = fully in. */
export function elementProgress(g: number, s: number, type: AnimElement): number {
  const arrival = s * SWEEP_SPAN + TYPE_OFFSET[type];
  return clamp01((g - arrival) / FADE);
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Overshooting ease for the dot "pop" — grows past full size, then settles. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Shared reveal clock. Canvases register an imperative redraw; `play()` steps a
 *  single rAF loop, advancing `progress` and firing every redraw (+ an optional
 *  per-frame hook used by the WEBM exporter to composite). `progress` is null
 *  when idle, so canvases fall back to their full static render. */
export class CoverAnimator {
  /** Origin of the radial wash, as fractions of the frame (0-1; {0.5,0.5} = centre).
   *  The studio sets this from its origin picker before each play; NodeCanvas reads it
   *  to place every element by its distance from this point. */
  originX = 0.5;
  originY = 0.5;

  /** Which way the wash travels relative to the origin — see WashDirection. 'out'
   *  reproduces the original centre-outward reveal; 'in' converges from the edges.
   *  NodeCanvas reads it each frame to flip each element's sweep coordinate. */
  direction: WashDirection = 'out';

  /** Multiplier applied to each canvas's internal render width. 1 = normal preview
   *  resolution; the high-quality WEBM export bumps this so the layers genuinely
   *  render at ~2160p during capture (a true high-res render, not an upscale), then
   *  resets it to 1 and redraws. */
  renderScale = 1;

  /** Randomness of the radial wash, 0-1. 0 = a perfectly clean circular front; higher
   *  ragged-ens the front by displacing each element's arrival by a stable per-element
   *  amount (up to ±JITTER_SPAN). The studio sets this from the Randomness slider; it
   *  applies to preview and every export because NodeCanvas reads it each frame. */
  jitter = 0;

  private progress: number | null = null;
  private redrawers = new Set<() => void>();
  private raf = 0;
  private playing = false;

  totalMs(): number {
    return ANIM.leadMs + ANIM.sweepMs + ANIM.tailMs;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Current reveal progress (0-1), or null when idle → draw the full artwork. */
  getProgress(): number | null {
    return this.progress;
  }

  /** Register a canvas's redraw; returns an unregister fn. */
  registerRedraw(fn: () => void): () => void {
    this.redrawers.add(fn);
    return () => this.redrawers.delete(fn);
  }

  private redrawAll(): void {
    this.redrawers.forEach((fn) => fn());
  }

  /** Force every registered canvas to redraw now (e.g. to re-render at the normal
   *  resolution after a high-res export resets `renderScale`). */
  requestRedraw(): void {
    this.redrawAll();
  }

  /** Synchronously render a single reveal frame at sweep progress `p` (0-1), off the
   *  rAF clock. The offline image-sequence export steps this frame-by-frame so every
   *  frame is fully rendered — no dropped frames under 2160p load. */
  renderAt(p: number): void {
    this.progress = clamp01(p);
    this.redrawAll();
  }

  /** Play the reveal once. Resolves after the full lead+sweep+tail. `onFrame` fires
   *  after each frame's redraw (so composited canvases are already up to date). */
  play(opts?: { onFrame?: (progress: number) => void }): Promise<void> {
    this.stop();
    this.playing = true;
    const total = this.totalMs();
    return new Promise<void>((resolve) => {
      let start: number | null = null;
      const tick = (ts: number): void => {
        if (start === null) start = ts;
        const elapsed = ts - start;
        // Hold at 0 through the lead, then advance 0→1 across the sweep, then hold at 1.
        const swept = Math.max(0, elapsed - ANIM.leadMs);
        const p = clamp01(swept / ANIM.sweepMs);
        this.progress = p;
        this.redrawAll();
        opts?.onFrame?.(p);
        if (elapsed < total) {
          this.raf = requestAnimationFrame(tick);
        } else {
          // Back to the static full render and release the clock.
          this.progress = null;
          this.playing = false;
          this.redrawAll();
          opts?.onFrame?.(1);
          resolve();
        }
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  /** Cancel any in-flight playback and return to the static render. */
  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.progress !== null) {
      this.progress = null;
      this.redrawAll();
    }
    this.playing = false;
  }
}
