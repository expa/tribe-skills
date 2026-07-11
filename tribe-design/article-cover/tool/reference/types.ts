/** Named slots in the global palette (mirrors the labels shown in the palette pane). */
export type NodePaletteKey = 'color1' | 'color2' | 'color3' | 'color4' | 'color5' | 'color6' | 'color7' | 'color8' | 'color9' | 'color10';

/** Edge-generation algorithm for traces between sampled points:
 *  - 'strict'      → every pair within Distance (the original behaviour)
 *  - 'free'        → random subset of the strict graph (looser look)
 *  - 'traces'      → tree growth from seed points (branch-like)
 *  - 'flow'        → connect each point to a neighbour along a noise direction field
 *  - 'directional' → only keep strict edges whose angle aligns with the bias */
export type NodeRouting = 'strict' | 'free' | 'traces' | 'flow' | 'directional';

/** A luma-driven highlight pass within a layer: the dots (or connection lines) sitting
 *  on the image's brightest pixels — within the `thresholdRange` window, gated on the
 *  gamma-adjusted source luma — are drawn in `colorKey` instead of the layer's base
 *  dot/line color. `amount` is the coverage (how many light up, brightest first) and
 *  `seed` picks the stable subset; a line pass also recolors the dots its highlighted
 *  traces connect. The UI allows up to three per layer. */
export interface NodeNuance {
  id: string;
  /** What this pass recolors. Lines test their midpoint luma and pull their endpoint
   *  dots along. Optional for preset compatibility — absent means 'dots'. */
  target?: 'dots' | 'lines';
  /** Palette slot for the highlighted elements — resolves against the active theme.
   *  Never the background slot's color; generation and theme switches keep it visible. */
  colorKey: NodePaletteKey;
  /** Coverage (0-1) — how much of the eligible (in-window) elements get recolored,
   *  weighted toward the brightest so the accent tracks the image's highlights.
   *  The UI exposes 0-100%. */
  amount: number;
  /** Luma window (0-255) — the tonal band that's eligible. Set high to highlight the
   *  image's bright areas, low for its shadows. */
  thresholdRange: { min: number; max: number };
  /** Selection seed — picks which eligible elements get the accent (stable per render);
   *  re-rolling it shuffles the highlighted subset. */
  seed: number;
}

/** One vignette pass: a feathered inset that thins generated points toward the frame border
 *  (or, inverted, away from it). Multiple passes stack multiplicatively — a point must survive
 *  every pass — so e.g. a border fade plus an inverted center-clear leaves the art as a ring. */
export interface Vignette {
  /** Fade depth as a fraction of the shorter frame edge (0 disables this pass). */
  amount: number;
  /** Falloff contrast (0-1): >0.5 hardens the outer band, <0.5 softens it. */
  contrast: number;
  /** Invert: clear the center and keep a feathered band along the edges instead. */
  invert: boolean;
}

export interface NodeSettings {
  /** Target count of sampled points. */
  density: number;
  /** Inclusive luminance window (0-255) — only pixels whose adjusted luma falls in [min, max]
   *  are eligible to be sampled. Parent + sublayers can carve the image into non-overlapping bands. */
  thresholdRange: { min: number; max: number };
  /** Gamma curve applied to luma before the threshold compare. <1 darkens, >1 lightens. */
  gamma: number;
  /** Multiplier on the base dot radius. */
  dotScale: number;
  /** Multiplier on the base line width. */
  lineScale: number;
  /** Max trace distance in luma-map pixels (0 disables traces). */
  distance: number;
  /** When true, lay points on a shared uniform lattice instead of rejection-sampling.
   *  Density snaps to the nearest lattice level (power-of-two strides), so every grid
   *  layer aligns to the same grid regardless of its density. */
  grid: boolean;
  /** Edge-generation algorithm. */
  routing: NodeRouting;
  /** Preferred angle in degrees (0 = →, 90 = ↑) for routing='directional'. */
  dirAngle: number;
  /** Tolerance around dirAngle in degrees, for routing='directional'. */
  dirSpread: number;
  /** Average neighbours per node when routing='traces'. */
  traceBranch: number;
  /** Triangulate closed loops in the trace graph and fill them. */
  fill: boolean;
  /** Render each dot as an outline (stroke only) instead of a filled disc. */
  dotOutline: boolean;
  /** Outline stroke width as a fraction of the base dot radius (only used when dotOutline). */
  dotOutlineWidth: number;
  /** Palette slot used for dot fills. */
  dotColorKey: NodePaletteKey;
  /** Palette slot used for line strokes. */
  lineColorKey: NodePaletteKey;
  /** Sparse dot-highlight passes (max 3 in the UI). Optional for preset compatibility. */
  nuances?: NodeNuance[];
  /** Reproducibility seed for the point sampler. */
  seed: number;
  /** Image position offset as a fraction of the viewport (-1..1), applied after fitting. */
  imageOffsetX: number;
  imageOffsetY: number;
}

/** A child rendering of the same node layer with its own settings (threshold/etc.) but
 *  inheriting the parent's image source. */
export interface NodeSubLayer {
  id: string;
  settings: NodeSettings;
  /** When set, this layer is a user-uploaded vector overlay (raw SVG markup) instead of a
   *  node-generated layer. It is tinted to `svgColorKey` and contain-fit into the frame. */
  svg?: string;
  /** Palette slot the SVG overlay is tinted with. */
  svgColorKey?: NodePaletteKey;
  /** SVG overlay size as a fraction of the frame (contain-fit, centered). */
  svgScale?: number;
}

/** The single node composition. The image source feeds the parent NodeCanvas and every
 *  sublayer's NodeCanvas (sublayers come from presets — each renders its own threshold band). */
export interface Layer {
  id: string;
  nodeSource?: string;
  nodeSettings?: NodeSettings;
  nodeSubLayers?: NodeSubLayer[];
  /** Where the parent's own canvas sits in the render stack relative to the sublayers
   *  (0 = drawn first/bottom). Sublayers stack in array order around it. */
  parentStackIndex?: number;
}

/** Canvas-frame aspect ratio. Drives the centered canvas frame's CSS aspect-ratio and
 *  every NodeCanvas's internal sampling rectangle. */
export type AspectRatio = '1:1' | '3:2' | '2:3' | '16:9' | '9:16';

/** Global ten-slot palette, ordered light → dark (white first, two eased ramps — warm then cool).
 *  Dot/Line palette keys reference these slots, and the canvas-frame background references one
 *  of them via NodeApp.backgroundColorKey. */
export interface Palette {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  color6: string;
  color7: string;
  color8: string;
  color9: string;
  color10: string;
}
