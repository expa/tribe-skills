'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { type NodeNuance, type NodePaletteKey, type NodeRouting, type NodeSettings, type Vignette } from '../types';
import { edgeKeepWeight } from '../edgeFade';
import { type CoverAnimator, elementProgress, easeOutCubic, easeOutBack, JITTER_SPAN } from '../coverAnimation';

interface NodeCanvasProps {
  source?: string;
  settings: NodeSettings;
  /** Ten-element palette indexed by NodePaletteKey order: color1, color2, …, color10. */
  palette?: string[];
  /** The canvas frame's background color. Outlined dots fill their interior with it so
   *  traces never show through a dot. */
  background?: string;
  /** Vignette passes: feathered insets that thin generated points toward (or, inverted, away
   *  from) the frame border so the background shows through cleanly. They stack
   *  multiplicatively — a point must survive every pass. Empty → no fade. Because they shape
   *  the points, both the live canvas and every export inherit them automatically. */
  vignettes?: Vignette[];
  /** Global resize affector (0-1, default 1 = no change): scales every dot radius and line
   *  width down toward their per-element floors (MIN_DOT_R / MIN_LINE_W), applied on top of
   *  the per-layer dotScale/lineScale. Scrub it down to thin the whole scene across all layers. */
  elementScale?: number;
  /** Output frame aspect (width/height) — needed to evaluate the edge fade in frame space,
   *  since the source image is cover-fit (and may overflow the frame). */
  frameAspect?: number;
  /** Registers an SVG exporter for this canvas. Called with the function whenever the
   *  drawing data changes; called with `null` on unmount. The Node pane's Copy SVG button
   *  invokes the most-recently-registered exporter for the active layer. */
  onExporterReady?: (exporter: (() => string) | null) => void;
  /** Registers the backing <canvas> element so the Node pane's Copy PNG can snapshot it.
   *  Called with `null` on unmount. */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Shared reveal clock. When present, the canvas registers its redraw with it and,
   *  while it's playing, draws each element at its per-position/per-type progress
   *  (the intro "wash"). Idle → the full static render, exactly as before. */
  animation?: CoverAnimator;
  style?: CSSProperties;
}

/** Maps the source image's frame into a w×h viewport per the fit mode + position offset.
 *  Points are stored in normalized [0,1] image space, so both the canvas draw pass and the
 *  SVG export multiply through this same rect to stay pixel-identical. Exported so the
 *  Node pane's Media preview can position its image the same way the canvas does. */
export function computeFitRect(
  image: HTMLImageElement,
  w: number,
  h: number,
  settings: NodeSettings,
): { dx: number; dy: number; dw: number; dh: number } {
  const ar = image.naturalWidth / image.naturalHeight;
  let dw = w;
  let dh = w / ar;
  if (dh < h) {
    dh = h;
    dw = h * ar;
  }
  // Clamp the pan so the viewport stays covered — offsets are shuffled per image, and a
  // later format/media change can shrink the slack they were drawn against.
  return {
    dx: Math.min(0, Math.max(w - dw, (w - dw) / 2 + settings.imageOffsetX * w)),
    dy: Math.min(0, Math.max(h - dh, (h - dh) / 2 + settings.imageOffsetY * h)),
    dw,
    dh,
  };
}

/** Resolve a NodePaletteKey to its concrete color via the palette array. */
function resolvePaletteColor(key: NodePaletteKey, palette: string[] | undefined): string {
  const fallbacks: Record<NodePaletteKey, string> = {
    color1: '#FDFDFD',
    color2: '#FFC336',
    color3: '#E88B1C',
    color4: '#A4500B',
    color5: '#6B3209',
    color6: '#95FCFB',
    color7: '#65D9EE',
    color8: '#3B9FC4',
    color9: '#1D5D7E',
    color10: '#06141C',
  };
  const p = palette ?? [];
  switch (key) {
    case 'color1': return p[0] ?? fallbacks.color1;
    case 'color2': return p[1] ?? fallbacks.color2;
    case 'color3': return p[2] ?? fallbacks.color3;
    case 'color4': return p[3] ?? fallbacks.color4;
    case 'color5': return p[4] ?? fallbacks.color5;
    case 'color6': return p[5] ?? fallbacks.color6;
    case 'color7': return p[6] ?? fallbacks.color7;
    case 'color8': return p[7] ?? fallbacks.color8;
    case 'color9': return p[8] ?? fallbacks.color9;
    case 'color10': return p[9] ?? fallbacks.color10;
  }
}

/** Fixed internal render width. The canvas always draws at this resolution (height follows
 *  the selected aspect ratio) and CSS scales it to fit its slot, so dot/line proportions are
 *  identical whether the preview is large or thumbnail-sized — and exports are stable. */
export const RENDER_W = 1452;

/** Floors for the global resize affector, in render-canvas pixels: a fully shrunk dot keeps a
 *  1px radius and a line a 1.15px width, so scrubbing the affector all the way down thins the
 *  scene without ever making dots or lines vanish. */
export const MIN_DOT_R = 1;
export const MIN_LINE_W = 1.15;

/** Apply the global resize affector to a natural element size: scale it by `s` (0-1) but never
 *  below `floor`, and never *above* its natural size (a sub-floor element is left untouched). */
function shrinkToFloor(natural: number, s: number, floor: number): number {
  return Math.max(Math.min(natural, floor), natural * s);
}
/** Resolution of the luminance map we read pixels from. Independent of viewport size so density
 *  sampling stays consistent as the window resizes. */
const SAMPLE_W = 320;
/** Fixed seed for the reveal's per-element sweep jitter — stable so the ragged front looks
 *  the same every play and matches between preview and export. */
const JITTER_SEED = 0x5eed;

/** Deterministic per-index hash → 0-1. Picks each pass's highlight subset so it's
 *  stable across re-renders and identical in the SVG export. */
function hash01(i: number, seed: number): number {
  let t = (Math.imul(i + 1, 2654435761) ^ Math.imul(seed + 1, 1597334677)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Luma-driven highlight test: an element is recolored when its gamma-adjusted source
 *  luma (`adj`, 0-255) falls in the pass's window AND a stable per-element draw lands
 *  under the coverage probability. The probability is weighted by how bright the element
 *  is within the window, so the accent concentrates on the image's highlights — the
 *  brightest pixels light up first, dimmer ones fill in as `amount` (coverage 0-1) rises.
 *  `key` is the element's index and `n` the pass index, so each pass picks an
 *  independent, reproducible subset that re-rolls with the seed. */
function lumaHighlight(adj: number, nu: NodeNuance, n: number, key: number): boolean {
  const { min, max } = nu.thresholdRange;
  if (adj < min || adj > max) return false;
  const b = (adj - min) / Math.max(1, max - min); // 0 at window floor → 1 at its ceiling
  const prob = nu.amount * (0.25 + 0.75 * b);      // brighter → likelier; floor keeps ~25%
  return hash01(key, nu.seed * 101 + n) < prob;
}

/** Deterministic 32-bit PRNG (mulberry32). Reproducible across renders for a given seed. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SampleMap {
  width: number;
  height: number;
  /** Row-major luminance array, length = width * height, values 0-255. */
  luma: Uint8ClampedArray;
}

function buildSampleMap(img: HTMLImageElement): SampleMap | null {
  if (!img.complete || img.naturalWidth === 0) return null;
  const ar = img.naturalWidth / img.naturalHeight;
  const w = SAMPLE_W;
  const h = Math.max(1, Math.round(SAMPLE_W / ar));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.drawImage(img, 0, 0, w, h);
  const px = octx.getImageData(0, 0, w, h).data;
  const luma = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    // Rec. 709 luma
    luma[j] = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0;
  }
  return { width: w, height: h, luma };
}

interface Point {
  /** Normalised 0-1 within the sample map. */
  x: number;
  y: number;
  /** Source luma (0-1) at this point. Powers the gamma curve and line-color sampling. */
  luma: number;
}

/** Apply gamma to a 0-255 value, then test whether it falls inside [min, max] inclusive. */
function lumaPasses(v: number, gamma: number, rmin: number, rmax: number): boolean {
  const adjusted = gamma !== 1 ? ((v / 255) ** gamma) * 255 : v;
  return adjusted >= rmin && adjusted <= rmax;
}

/** Rejection-sample `density` points whose `field` value passes the threshold. The luma stored
 *  on each Point is taken from the original `originalLuma` (so luma-driven effects still reflect
 *  source brightness even when sampling against the edge map). */
function randomSample(
  field: Uint8ClampedArray,
  originalLuma: Uint8ClampedArray,
  w: number,
  h: number,
  settings: NodeSettings,
): Point[] {
  const { density, thresholdRange, gamma, seed } = settings;
  const rng = mulberry32(seed * 7919 + 1);
  const out: Point[] = [];
  const maxTries = density * 40;
  let tries = 0;
  while (out.length < density && tries < maxTries) {
    tries++;
    const ix = (rng() * w) | 0;
    const iy = (rng() * h) | 0;
    const idx = iy * w + ix;
    if (!lumaPasses(field[idx], gamma, thresholdRange.min, thresholdRange.max)) continue;
    out.push({ x: ix / w, y: iy / h, luma: originalLuma[idx] / 255 });
  }
  return out;
}

/** Grid mode samples a shared lattice: every layer's stride is a power-of-two multiple of
 *  one fixed base grid, and density snaps to the nearest level. A coarser grid's dots are
 *  therefore always a subset of a finer grid's positions, so grid layers align with each
 *  other regardless of their densities. */
function gridSample(
  field: Uint8ClampedArray,
  originalLuma: Uint8ClampedArray,
  w: number,
  h: number,
  settings: NodeSettings,
): Point[] {
  const { density, thresholdRange, gamma } = settings;
  const aspect = w / h;
  const BASE_ROWS = 4;
  const baseCols = Math.max(1, Math.round(BASE_ROWS * aspect));
  const idealRows = Math.max(1, Math.sqrt(density / aspect));
  const level = Math.max(0, Math.min(5, Math.round(Math.log2(idealRows / BASE_ROWS))));
  const rows = BASE_ROWS * 2 ** level;
  const cols = baseCols * 2 ** level;
  const out: Point[] = [];
  for (let cy = 0; cy <= rows; cy++) {
    for (let cx = 0; cx <= cols; cx++) {
      const x = cx / cols;
      const y = cy / rows;
      const ix = Math.min(w - 1, Math.floor(x * w));
      const iy = Math.min(h - 1, Math.floor(y * h));
      const idx = iy * w + ix;
      if (!lumaPasses(field[idx], gamma, thresholdRange.min, thresholdRange.max)) continue;
      out.push({ x, y, luma: originalLuma[idx] / 255 });
    }
  }
  return out;
}

function samplePoints(map: SampleMap, settings: NodeSettings): Point[] {
  return settings.grid
    ? gridSample(map.luma, map.luma, map.width, map.height, settings)
    : randomSample(map.luma, map.luma, map.width, map.height, settings);
}

/** Pair of point indices whose normalised distance is below the trace threshold. */
type Trace = [number, number];
type Triangle = [number, number, number];

/** Build a spatial grid keyed by maxDistNorm so neighbour scans are O(1) per point. */
function buildSpatialGrid(points: Point[], cellSize: number): { grid: Map<number, number[]>; cols: number } {
  const safeCell = Math.max(1e-6, cellSize);
  const cols = Math.max(1, Math.ceil(1 / safeCell));
  const grid = new Map<number, number[]>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const cx = Math.min(cols - 1, (p.x / safeCell) | 0);
    const cy = Math.min(cols - 1, (p.y / safeCell) | 0);
    const k = cy * cols + cx;
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }
  return { grid, cols };
}

/** Iterate candidate neighbours of point `i` within `maxDistNorm`. For each candidate j > i,
 *  invoke `visit(j, sqDist)`. */
function eachNeighbour(
  points: Point[],
  i: number,
  maxDistNorm: number,
  grid: Map<number, number[]>,
  cols: number,
  jMustExceedI: boolean,
  visit: (j: number, sqDist: number) => void,
): void {
  const cellSize = Math.max(1e-6, maxDistNorm);
  const p = points[i];
  const cx = Math.min(cols - 1, (p.x / cellSize) | 0);
  const cy = Math.min(cols - 1, (p.y / cellSize) | 0);
  const max2 = maxDistNorm * maxDistNorm;
  for (let dy = -1; dy <= 1; dy++) {
    const ny = cy + dy;
    if (ny < 0 || ny >= cols) continue;
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= cols) continue;
      const bucket = grid.get(ny * cols + nx);
      if (!bucket) continue;
      for (const j of bucket) {
        if (j === i) continue;
        if (jMustExceedI && j <= i) continue;
        const q = points[j];
        const ddx = p.x - q.x;
        const ddy = p.y - q.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 <= max2) visit(j, d2);
      }
    }
  }
}

/** Strict: all pairs within `maxDistNorm`. */
function routeStrict(points: Point[], maxDistNorm: number): Trace[] {
  if (maxDistNorm <= 0 || points.length < 2) return [];
  const { grid, cols } = buildSpatialGrid(points, maxDistNorm);
  const out: Trace[] = [];
  for (let i = 0; i < points.length; i++) {
    eachNeighbour(points, i, maxDistNorm, grid, cols, true, (j) => out.push([i, j]));
  }
  return out;
}

/** Free: random subset of strict (~40%) for a looser look. */
function routeFree(points: Point[], maxDistNorm: number, seed: number): Trace[] {
  const all = routeStrict(points, maxDistNorm);
  const rng = mulberry32(seed * 6271 + 9);
  return all.filter(() => rng() < 0.4);
}

/** Traces: tree growth — each point connects to its `traceBranch` nearest neighbours within
 *  `maxDistNorm`, building a forest. */
function routeTraces(points: Point[], maxDistNorm: number, traceBranch: number): Trace[] {
  if (maxDistNorm <= 0 || points.length < 2) return [];
  const { grid, cols } = buildSpatialGrid(points, maxDistNorm);
  const seen = new Set<number>();
  const out: Trace[] = [];
  for (let i = 0; i < points.length; i++) {
    const candidates: Array<[number, number]> = [];
    eachNeighbour(points, i, maxDistNorm, grid, cols, false, (j, d2) => {
      candidates.push([j, d2]);
    });
    candidates.sort((a, b) => a[1] - b[1]);
    for (let k = 0; k < Math.min(traceBranch, candidates.length); k++) {
      const j = candidates[k][0];
      const key = i < j ? i * points.length + j : j * points.length + i;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([Math.min(i, j), Math.max(i, j)]);
    }
  }
  return out;
}

/** Flow: each point connects to its nearest forward neighbour along a noise direction field. */
function routeFlow(points: Point[], maxDistNorm: number, seed: number): Trace[] {
  if (maxDistNorm <= 0 || points.length < 2) return [];
  const { grid, cols } = buildSpatialGrid(points, maxDistNorm);
  // Smooth 2D flow direction derived from sin/cos of point coordinates with a seed offset.
  const fieldAngle = (x: number, y: number) =>
    Math.sin(x * 6.28 + seed * 0.1) * 1.4 + Math.cos(y * 4.71 + seed * 0.07) * 1.1;
  const out: Trace[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const flowA = fieldAngle(p.x, p.y);
    const fx = Math.cos(flowA);
    const fy = Math.sin(flowA);
    let bestJ = -1;
    let bestScore = -Infinity;
    eachNeighbour(points, i, maxDistNorm, grid, cols, false, (j, d2) => {
      const q = points[j];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const dot = dx * fx + dy * fy;
      // Prefer neighbours both close and well-aligned with the flow direction.
      const score = dot / (Math.sqrt(d2) + 1e-6);
      if (score > bestScore) { bestScore = score; bestJ = j; }
    });
    if (bestJ >= 0 && bestScore > 0) {
      const key = Math.min(i, bestJ) * points.length + Math.max(i, bestJ);
      if (!seen.has(key)) {
        seen.add(key);
        out.push([Math.min(i, bestJ), Math.max(i, bestJ)]);
      }
    }
  }
  return out;
}

/** Directional: strict edges, but only those whose angle is within `spread` degrees of `angle`. */
function routeDirectional(
  points: Point[],
  maxDistNorm: number,
  angleDeg: number,
  spreadDeg: number,
): Trace[] {
  if (maxDistNorm <= 0 || points.length < 2) return [];
  const { grid, cols } = buildSpatialGrid(points, maxDistNorm);
  const target = (angleDeg * Math.PI) / 180;
  const cosTarget = Math.cos(target);
  const sinTarget = Math.sin(target);
  // We measure angle modulo π so 'right' and 'left' along the same axis both qualify.
  const cosThreshold = Math.cos((spreadDeg * Math.PI) / 180);
  const out: Trace[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    eachNeighbour(points, i, maxDistNorm, grid, cols, true, (j) => {
      const q = points[j];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const align = Math.abs((dx * cosTarget + dy * sinTarget) / len);
      if (align >= cosThreshold) out.push([i, j]);
    });
  }
  return out;
}

function computeRouting(points: Point[], settings: NodeSettings, sampleW: number): Trace[] {
  const maxDistNorm = settings.distance / sampleW;
  const mode: NodeRouting = settings.routing;
  if (mode === 'strict') return routeStrict(points, maxDistNorm);
  if (mode === 'free') return routeFree(points, maxDistNorm, settings.seed);
  if (mode === 'traces') return routeTraces(points, maxDistNorm, settings.traceBranch);
  if (mode === 'flow') return routeFlow(points, maxDistNorm, settings.seed);
  return routeDirectional(points, maxDistNorm, settings.dirAngle, settings.dirSpread);
}

/** Find every triangle (i, j, k) with i<j<k where all three edges exist in `traces`. */
function computeTriangles(pointCount: number, traces: Trace[]): Triangle[] {
  // Adjacency: for each node, the set of higher-index neighbours.
  const adj: Set<number>[] = Array.from({ length: pointCount }, () => new Set<number>());
  for (const [i, j] of traces) adj[i].add(j);
  const out: Triangle[] = [];
  for (const [i, j] of traces) {
    // Common higher-index neighbour k > j with edges (i,k) and (j,k).
    const ai = adj[i];
    const aj = adj[j];
    if (aj.size === 0) continue;
    const [small, large] = ai.size < aj.size ? [ai, aj] : [aj, ai];
    for (const k of small) {
      if (k > j && large.has(k)) out.push([i, j, k]);
    }
  }
  return out;
}

export function NodeCanvas({ source, settings, palette, background, vignettes = [], elementScale = 1, frameAspect = 16 / 9, onExporterReady, onCanvasReady, animation, style }: NodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  // Image + sample map are state (not refs) so the points-memo re-runs when the image finishes loading.
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [sampleMap, setSampleMap] = useState<SampleMap | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      setSampleMap(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setSampleMap(buildSampleMap(img));
    };
    img.src = source;
    return () => {
      img.onload = null;
    };
  }, [source]);

  // Only vignettes with a non-zero amount thin anything. Memoise on a serialized key (the
  // snapshot hands us a fresh array reference every notify) so the point sampler below only
  // re-runs when a vignette's values actually change — not on unrelated edits like colors.
  const vignetteKey = vignettes.map((v) => `${v.amount}:${v.contrast}:${v.invert}`).join(',');
  const activeVignettes = useMemo(
    () => vignettes.filter((v) => v.amount > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vignetteKey captures the contents
    [vignetteKey],
  );

  // Sampled points are deterministic in (sampleMap + settings); memoise to avoid re-sampling on resize.
  const points = useMemo<Point[] | null>(() => {
    if (!sampleMap) return null;
    const pts = samplePoints(sampleMap, settings);
    // Vignettes: thin points toward the frame border (in frame space, since the image is
    // cover-fit) so the background reads as clean inset padding. Passes stack multiplicatively
    // — a point survives only if a single stable per-point hash clears the combined keep-weight
    // — so the falloff stays soft and reproducible across renders/exports.
    if (activeVignettes.length === 0 || !image) return pts;
    const w = RENDER_W;
    const h = Math.max(1, Math.round(RENDER_W / frameAspect));
    const { dx, dy, dw, dh } = computeFitRect(image, w, h, settings);
    return pts.filter((p, i) => {
      const fx = dx + p.x * dw;
      const fy = dy + p.y * dh;
      let keep = 1;
      for (const v of activeVignettes) keep *= edgeKeepWeight(fx, fy, w, h, v.amount, v.contrast, v.invert);
      return hash01(i, settings.seed) < keep;
    });
  }, [
    sampleMap,
    image,
    activeVignettes,
    frameAspect,
    settings.density,
    settings.thresholdRange.min,
    settings.thresholdRange.max,
    settings.gamma,
    settings.seed,
    settings.grid,
    settings.imageOffsetX,
    settings.imageOffsetY,
  ]);

  // Traces depend on routing algorithm + its parameters.
  const traces = useMemo<Trace[]>(() => {
    if (!points || !sampleMap) return [];
    return computeRouting(points, settings, sampleMap.width);
  }, [
    points,
    sampleMap,
    settings.distance,
    settings.routing,
    settings.dirAngle,
    settings.dirSpread,
    settings.traceBranch,
    settings.seed,
  ]);

  // Triangles for Fill mode: only computed when Fill is on (avoids the cost otherwise).
  const triangles = useMemo<Triangle[]>(() => {
    if (!settings.fill || !points || traces.length === 0) return [];
    return computeTriangles(points.length, traces);
  }, [settings.fill, points, traces]);

  // Colors are resolved from named palette slots so changing the palette flows through.
  const lineColor = resolvePaletteColor(settings.lineColorKey, palette);
  const dotColor = resolvePaletteColor(settings.dotColorKey, palette);

  // Nuances: which highlight pass (index into settings.nuances) claims each dot/trace;
  // -1 = base color. A pass recolors elements whose gamma-adjusted source luma sits in
  // its window, weighted toward the brightest (see lumaHighlight) so the accent tracks
  // the image's highlights. First match wins. A line pass ALSO claims the dots its
  // highlighted traces connect, so a run reads as one piece (lines + nodes).
  const nuances = settings.nuances ?? [];
  const nuanceKey = JSON.stringify(nuances);
  const nuanceTarget = (nu: { target?: 'dots' | 'lines' }): 'dots' | 'lines' => nu.target ?? 'dots';
  // Line highlights test the trace's midpoint luma, so bright runs of traces highlight
  // together as continuous paths.
  const lineNuanceAssignment = useMemo<Int8Array | null>(() => {
    if (!points || traces.length === 0 || !nuances.some((nu) => nuanceTarget(nu) === 'lines')) return null;
    const out = new Int8Array(traces.length).fill(-1);
    for (let t = 0; t < traces.length; t++) {
      const [i, j] = traces[t];
      const luma = (points[i].luma + points[j].luma) / 2;
      const adjusted = settings.gamma !== 1 ? (luma ** settings.gamma) * 255 : luma * 255;
      for (let n = 0; n < nuances.length; n++) {
        const nu = nuances[n];
        if (nuanceTarget(nu) !== 'lines') continue;
        if (lumaHighlight(adjusted, nu, n, t)) {
          out[t] = n;
          break;
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, traces, nuanceKey, settings.gamma]);
  const nuanceAssignment = useMemo<Int8Array | null>(() => {
    const hasDotNuance = nuances.some((nu) => nuanceTarget(nu) === 'dots');
    if (!points || (!hasDotNuance && !lineNuanceAssignment)) return null;
    const out = new Int8Array(points.length).fill(-1);
    // Dots connected by a highlighted trace inherit its claim, so a bright run's nodes
    // light up with their lines. Direct dot-pass claims below take precedence.
    if (lineNuanceAssignment) {
      for (let t = 0; t < traces.length; t++) {
        const n = lineNuanceAssignment[t];
        if (n < 0) continue;
        const [i, j] = traces[t];
        if (out[i] === -1) out[i] = n;
        if (out[j] === -1) out[j] = n;
      }
    }
    if (hasDotNuance) {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const adjusted = settings.gamma !== 1 ? (p.luma ** settings.gamma) * 255 : p.luma * 255;
        for (let n = 0; n < nuances.length; n++) {
          const nu = nuances[n];
          if (nuanceTarget(nu) !== 'dots') continue;
          if (lumaHighlight(adjusted, nu, n, i)) {
            out[i] = n;
            break;
          }
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, traces, nuanceKey, lineNuanceAssignment, settings.gamma]);
  const nuanceColors = nuances.map((n) => resolvePaletteColor(n.colorKey, palette));
  const nuanceColorsKey = nuanceColors.join(',');

  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Draw at the fixed render resolution; the slot's CSS aspect-ratio gives us the shape.
    const clientW = canvas.clientWidth || 16;
    const clientH = canvas.clientHeight || 9;
    // renderScale is 1 for preview and every raster/SVG export; the high-quality WEBM
    // export bumps it so this backing store is a true ~2160p render (CSS still scales
    // the element to its slot, so on-screen size is unchanged — just sharper).
    const scale = animation?.renderScale ?? 1;
    const w = Math.round(RENDER_W * scale);
    const h = Math.max(1, Math.round(w * (clientH / clientW)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // No image/points yet — leave the canvas transparent so only the palette
    // background shows (no placeholder text).
    if (!image || !points) return;

    // Fit the source frame into the viewport (contain = whole image, cover = fill + crop),
    // nudged by the user's position offset. Dots are drawn in that frame.
    const { dx, dy, dw, dh } = computeFitRect(image, w, h, settings);

    const baseRadius = Math.max(0.5, Math.min(dw, dh) / 320);
    // Natural sizes from the per-layer scales, then thinned by the global resize affector.
    const baseDotR = shrinkToFloor(baseRadius * settings.dotScale, elementScale, MIN_DOT_R);
    const lw = shrinkToFloor(Math.max(0.5, baseRadius * 0.6 * settings.lineScale), elementScale, MIN_LINE_W);

    const outlineW = Math.max(0.5, baseDotR * (settings.dotOutlineWidth ?? 0.25));

    // Intro reveal clock: null → full static render (the fast batched path below);
    // a number in 0-1 → the "wash", where each element animates in by its position
    // in the sweep (see coverAnimation). Per-element alpha/scale means we can't batch
    // by color, so the animated path draws element-by-element — fine for a one-shot.
    const animG = animation ? animation.getProgress() : null;

    if (animG === null) {
      // ── Static render (unchanged, batched by color group) ──────────────────
      // Fill: triangle faces underneath everything, semi-transparent so traces/dots read on top.
      if (settings.fill && triangles.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = lineColor;
        for (const [i, j, k] of triangles) {
          const a = points[i];
          const b = points[j];
          const c = points[k];
          ctx.beginPath();
          ctx.moveTo(dx + a.x * dw, dy + a.y * dh);
          ctx.lineTo(dx + b.x * dw, dy + b.y * dh);
          ctx.lineTo(dx + c.x * dw, dy + c.y * dh);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Traces above fill, below dots. One stroke pass per color group (base + each
      // line-targeted nuance), highlights after the base so they read on top.
      if (traces.length > 0) {
        const drawTraceGroup = (color: string, claim: number): void => {
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.beginPath();
          let any = false;
          for (let t = 0; t < traces.length; t++) {
            if ((lineNuanceAssignment ? lineNuanceAssignment[t] : -1) !== claim) continue;
            const [i, j] = traces[t];
            const a = points[i];
            const b = points[j];
            ctx.moveTo(dx + a.x * dw, dy + a.y * dh);
            ctx.lineTo(dx + b.x * dw, dy + b.y * dh);
            any = true;
          }
          if (any) ctx.stroke();
        };
        drawTraceGroup(lineColor, -1);
        nuanceColors.forEach((color, n) => {
          if (nuanceTarget(nuances[n]) === 'lines') drawTraceGroup(color, n);
        });
      }

      // Dots — always drawn after this layer's traces so connection lines sit below them.
      // Outlined dots fill their interior with the canvas background so traces never show
      // through the dot.
      const drawDotGroup = (color: string, claim: number): void => {
        if (settings.dotOutline) {
          ctx.strokeStyle = color;
          ctx.lineWidth = outlineW;
          ctx.fillStyle = background ?? '#FFFFFF';
        } else {
          ctx.fillStyle = color;
        }
        for (let i = 0; i < points.length; i++) {
          if ((nuanceAssignment ? nuanceAssignment[i] : -1) !== claim) continue;
          const p = points[i];
          const r = baseDotR;
          ctx.beginPath();
          ctx.arc(dx + p.x * dw, dy + p.y * dh, r, 0, Math.PI * 2);
          ctx.fill();
          if (settings.dotOutline) ctx.stroke();
        }
      };
      drawDotGroup(dotColor, -1);
      nuanceColors.forEach((color, n) => drawDotGroup(color, n));
      return;
    }

    // ── Animated "wash" render ────────────────────────────────────────────────
    // Per-point sweep coordinate (0 = enters first) drives every element's timing:
    // its distance from the studio's chosen origin, normalised so the farthest frame
    // corner is 1. Distances are in canvas pixels, so the ripple stays circular
    // regardless of the frame's aspect.
    const opx = (animation ? animation.originX : 0.5) * w;
    const opy = (animation ? animation.originY : 0.5) * h;
    const maxD = Math.max(
      Math.hypot(opx, opy),
      Math.hypot(w - opx, opy),
      Math.hypot(opx, h - opy),
      Math.hypot(w - opx, h - opy),
    ) || 1;
    // Randomness "affector": nudge each element's sweep position by a stable per-element
    // offset (±JITTER_SPAN, scaled by the dial) so the front ragged-ens instead of
    // advancing as a perfect circle. hash01 keeps it deterministic across frames — no
    // flicker — and identical between preview and export.
    const jitter = animation ? animation.jitter : 0;
    // 'in' converges from the edges toward the origin: flip each element's distance
    // ratio so the farthest elements enter first and the front collapses inward.
    const inward = animation ? animation.direction === 'in' : false;
    const sweep = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(dx + points[i].x * dw - opx, dy + points[i].y * dh - opy);
      let s = d > maxD ? 1 : d / maxD;
      if (inward) s = 1 - s;
      if (jitter > 0) {
        s += (hash01(i, JITTER_SEED) * 2 - 1) * jitter * JITTER_SPAN;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
      }
      sweep[i] = s;
    }

    // Fills fade in underneath, keyed to their centroid.
    if (settings.fill && triangles.length > 0) {
      ctx.save();
      ctx.fillStyle = lineColor;
      for (const [i, j, k] of triangles) {
        const lp = elementProgress(animG, (sweep[i] + sweep[j] + sweep[k]) / 3, 'fill');
        if (lp <= 0) continue;
        ctx.globalAlpha = 0.25 * easeOutCubic(lp);
        const a = points[i];
        const b = points[j];
        const c = points[k];
        ctx.beginPath();
        ctx.moveTo(dx + a.x * dw, dy + a.y * dh);
        ctx.lineTo(dx + b.x * dw, dy + b.y * dh);
        ctx.lineTo(dx + c.x * dw, dy + c.y * dh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Traces draw in — each grows from its leading endpoint toward the trailing one,
    // right after the dots at that spot have popped.
    if (traces.length > 0) {
      ctx.lineWidth = lw;
      for (let t = 0; t < traces.length; t++) {
        const [i, j] = traces[t];
        const lp = elementProgress(animG, (sweep[i] + sweep[j]) / 2, 'line');
        if (lp <= 0) continue;
        // Anchor at the endpoint the wash reaches first so the line draws in the sweep direction.
        const [aIdx, bIdx] = sweep[i] <= sweep[j] ? [i, j] : [j, i];
        const a = points[aIdx];
        const b = points[bIdx];
        const drawP = easeOutCubic(lp);
        const ax = dx + a.x * dw;
        const ay = dy + a.y * dh;
        const bx = dx + b.x * dw;
        const by = dy + b.y * dh;
        const claim = lineNuanceAssignment ? lineNuanceAssignment[t] : -1;
        ctx.strokeStyle = claim >= 0 ? nuanceColors[claim] : lineColor;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * drawP, ay + (by - ay) * drawP);
        ctx.stroke();
      }
    }

    // Dots pop in — scale from nothing with a little overshoot.
    for (let i = 0; i < points.length; i++) {
      const lp = elementProgress(animG, sweep[i], 'dot');
      if (lp <= 0) continue;
      const r = baseDotR * Math.max(0, easeOutBack(lp));
      if (r <= 0.05) continue;
      const p = points[i];
      const claim = nuanceAssignment ? nuanceAssignment[i] : -1;
      const color = claim >= 0 ? nuanceColors[claim] : dotColor;
      if (settings.dotOutline) {
        ctx.strokeStyle = color;
        ctx.lineWidth = outlineW;
        ctx.fillStyle = background ?? '#FFFFFF';
      } else {
        ctx.fillStyle = color;
      }
      ctx.beginPath();
      ctx.arc(dx + p.x * dw, dy + p.y * dh, r, 0, Math.PI * 2);
      ctx.fill();
      if (settings.dotOutline) ctx.stroke();
    }
  };

  // Register an SVG exporter that mirrors the canvas exactly: same viewport size + fit rect,
  // so the exported SVG IS the canvas (fit mode and position offset included).
  useEffect(() => {
    if (!onExporterReady) return;
    const buildSvg = (): string => {
      const pts = points ?? [];
      const canvas = canvasRef.current;
      // Mirror the canvas's fixed render resolution so the SVG is pixel-identical.
      const clientW = canvas?.clientWidth || 16;
      const clientH = canvas?.clientHeight || 9;
      const w = RENDER_W;
      const h = Math.max(1, Math.round(RENDER_W * (clientH / clientW)));
      const { dx, dy, dw, dh } = image
        ? computeFitRect(image, w, h, settings)
        : { dx: 0, dy: 0, dw: w, dh: h };
      const px = (x: number): number => dx + x * dw;
      const py = (y: number): number => dy + y * dh;
      const baseRadius = Math.max(0.5, Math.min(dw, dh) / 320);
      // Mirror the canvas: per-layer scales thinned by the global resize affector.
      const baseDotR = shrinkToFloor(baseRadius * settings.dotScale, elementScale, MIN_DOT_R);
      const lw = shrinkToFloor(Math.max(0.5, baseRadius * 0.6 * settings.lineScale), elementScale, MIN_LINE_W);
      const parts: string[] = [];
      // Include Inkscape namespace so `inkscape:groupmode="layer"` is honored as proper layers
      // in Inkscape; Illustrator/Figma treat the `<g id="...">` as named groups regardless.
      // Cover-fit maps points outside the visible crop; cull whole elements outside the
      // frame and clip the rest so the export contains nothing beyond the artwork area.
      const cullPad = Math.max(lw, baseDotR * 5.5);
      const inFrame = (minX: number, maxX: number, minY: number, maxY: number): boolean =>
        maxX >= -cullPad && minX <= w + cullPad && maxY >= -cullPad && minY <= h + cullPad;
      const clipId = `frame-${Math.random().toString(36).slice(2, 9)}`;
      parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
      );
      parts.push(`<defs><clipPath id="${clipId}"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath></defs>`);
      // Layer 1: fill triangles underneath (matches canvas globalAlpha=0.25 + lineColor).
      if (settings.fill && triangles.length > 0) {
        parts.push(`<g id="fills" inkscape:groupmode="layer" inkscape:label="Fills" clip-path="url(#${clipId})">`);
        for (const [i, j, k] of triangles) {
          const a = pts[i], b = pts[j], c = pts[k];
          if (!a || !b || !c) continue;
          const xs = [px(a.x), px(b.x), px(c.x)];
          const ys = [py(a.y), py(b.y), py(c.y)];
          if (!inFrame(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))) continue;
          parts.push(
            `<polygon points="${xs[0]},${ys[0]} ${xs[1]},${ys[1]} ${xs[2]},${ys[2]}" fill="${lineColor}" fill-opacity="0.25"/>`,
          );
        }
        parts.push('</g>');
      }
      // Layer 2: traces (lines between points). Nuance-claimed traces use their highlight
      // color, matching the canvas.
      if (traces.length > 0) {
        parts.push(`<g id="traces" inkscape:groupmode="layer" inkscape:label="Traces" clip-path="url(#${clipId})">`);
        for (let t = 0; t < traces.length; t++) {
          const [i, j] = traces[t];
          const a = pts[i], b = pts[j];
          if (!a || !b) continue;
          const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
          if (!inFrame(Math.min(x1, x2), Math.max(x1, x2), Math.min(y1, y2), Math.max(y1, y2))) continue;
          const claim = lineNuanceAssignment ? lineNuanceAssignment[t] : -1;
          const color = claim >= 0 ? nuanceColors[claim] : lineColor;
          parts.push(
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${lw}" stroke-linecap="butt"/>`,
          );
        }
        parts.push('</g>');
      }
      // Layer 3: dots. Nuance-claimed dots use their highlight color, matching the canvas.
      if (pts.length > 0) {
        parts.push(`<g id="dots" inkscape:groupmode="layer" inkscape:label="Dots" clip-path="url(#${clipId})">`);
        const outlineW = Math.max(0.5, baseDotR * (settings.dotOutlineWidth ?? 0.25));
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const claim = nuanceAssignment ? nuanceAssignment[i] : -1;
          const color = claim >= 0 ? nuanceColors[claim] : dotColor;
          const r = baseDotR;
          const cx = px(p.x), cy = py(p.y);
          if (!inFrame(cx - r, cx + r, cy - r, cy + r)) continue;
          const paint = settings.dotOutline
            ? `fill="${background ?? '#FFFFFF'}" stroke="${color}" stroke-width="${outlineW}"`
            : `fill="${color}"`;
          parts.push(
            `<circle cx="${cx}" cy="${cy}" r="${r}" ${paint}/>`,
          );
        }
        parts.push('</g>');
      }
      parts.push('</svg>');
      return parts.join('');
    };
    onExporterReady(buildSvg);
    return () => onExporterReady(null);
  }, [points, traces, triangles, image, settings.dotScale, settings.lineScale, elementScale, settings.fill, settings.dotOutline, settings.dotOutlineWidth, settings.imageOffsetX, settings.imageOffsetY, dotColor, lineColor, background, nuanceAssignment, lineNuanceAssignment, nuanceColorsKey, onExporterReady]);

  // Register the backing <canvas> so the Node pane's Copy PNG can snapshot it.
  useEffect(() => {
    if (!onCanvasReady) return;
    onCanvasReady(canvasRef.current);
    return () => onCanvasReady(null);
  }, [onCanvasReady]);

  // Join the shared reveal clock: while it plays, it calls this canvas's redraw each
  // frame. The wrapper stays stable (drawRef is reassigned in place), so the animator
  // always drives the latest draw closure without re-registering.
  useEffect(() => {
    if (!animation) return;
    return animation.registerRedraw(() => drawRef.current());
  }, [animation]);

  useEffect(() => {
    drawRef.current();
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [
    points,
    traces,
    triangles,
    image,
    settings.dotScale,
    settings.lineScale,
    elementScale,
    settings.fill,
    settings.dotOutline,
    settings.dotOutlineWidth,
    settings.imageOffsetX,
    settings.imageOffsetY,
    dotColor,
    lineColor,
    background,
    nuanceAssignment,
    lineNuanceAssignment,
    nuanceColorsKey,
  ]);

  return (
    <div
      className="node-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}