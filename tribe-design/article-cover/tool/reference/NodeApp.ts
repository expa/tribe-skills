import type { AspectRatio, Layer, NodeNuance, NodePaletteKey, NodeRouting, NodeSettings, NodeSubLayer, Palette, Vignette } from '../types';
import { BUNDLED_PRESETS, type Preset } from '../presets';
import { DEFAULT_NODE_SETTINGS, randomSample } from '../defaults';
import { DEFAULT_THEME, THEMES, type Theme } from '../themes';
import { EDGE_FADE_DEFAULT, EDGE_FADE_CONTRAST_DEFAULT, defaultVignette } from '../edgeFade';

export interface NodeAppSnapshot {
  layer: Layer;
  palette: Palette;
  themeName: string;
  aspectRatio: AspectRatio;
  backgroundColorKey: NodePaletteKey;
  /** Vignette passes (feathered insets that thin points toward — or, inverted, away from —
   *  the frame border). They stack multiplicatively; empty = no fade. */
  vignettes: Vignette[];
  /** Global resize affector (0-1, 1 = full size): scales every dot and line down across all
   *  layers toward their per-element minimums. */
  elementScale: number;
  /** Sublayer the properties panel is scoped to; null = the parent layer. */
  selectedSubLayerId: string | null;
  /** Name of the preset whose settings are still untouched; null once the user customizes. */
  activePresetName: string | null;
}

type Listener = () => void;

/** The composition's render stack, bottom-first: sublayer ids with `null` marking the
 *  parent layer's position. Canvases, the layer strip, and exports all share this order. */
export function computeStack(layer: Layer): Array<string | null> {
  const subIds = (layer.nodeSubLayers ?? []).map((s) => s.id);
  const idx = Math.max(0, Math.min(layer.parentStackIndex ?? 0, subIds.length));
  return [...subIds.slice(0, idx), null, ...subIds.slice(idx)];
}

export class NodeApp {
  layer: Layer;
  palette: Palette = { ...DEFAULT_THEME.palette };
  themeName: string = DEFAULT_THEME.name;
  aspectRatio: AspectRatio = '3:2';
  backgroundColorKey: NodePaletteKey = DEFAULT_THEME.backgroundColorKey;
  vignettes: Vignette[] = [defaultVignette()];
  elementScale: number = 1;
  selectedSubLayerId: string | null = null;
  activePresetName: string | null = null;

  readonly nodeSvgExporters = new Map<string, () => string>();
  readonly nodeCanvases = new Map<string, HTMLCanvasElement>();

  private listeners = new Set<Listener>();
  private snapshot: NodeAppSnapshot;

  constructor() {
    this.layer = {
      id: crypto.randomUUID(),
      nodeSettings: { ...DEFAULT_NODE_SETTINGS },
    };
    // Boot with a random preset + random image so the canvas is never blank on load.
    this.applyPreset(BUNDLED_PRESETS[Math.floor(Math.random() * BUNDLED_PRESETS.length)]);
    this.snapshot = this.buildSnapshot();
  }

  // ── React glue ────────────────────────────────────────────────────────────

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = (): NodeAppSnapshot => this.snapshot;

  notify(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private buildSnapshot(): NodeAppSnapshot {
    const l = this.layer;
    return {
      layer: {
        ...l,
        nodeSettings: l.nodeSettings ? { ...l.nodeSettings } : undefined,
        nodeSubLayers: l.nodeSubLayers?.map((s) => ({ ...s, settings: { ...s.settings } })),
      },
      palette: { ...this.palette },
      themeName: this.themeName,
      aspectRatio: this.aspectRatio,
      backgroundColorKey: this.backgroundColorKey,
      vignettes: this.vignettes.map((v) => ({ ...v })),
      elementScale: this.elementScale,
      selectedSubLayerId: this.selectedSubLayerId,
      activePresetName: this.activePresetName,
    };
  }

  /** The user changed a parameter by hand — the composition no longer matches a preset. */
  markCustomized(): void {
    this.activePresetName = null;
  }

  /** Scope the properties panel to a sublayer (or back to the parent with null). */
  selectSubLayer(id: string | null): void {
    this.selectedSubLayerId = id;
    this.notify();
  }

  /** Add a user-uploaded vector as a new top layer, tinted to a visible palette slot, and
   *  select it. SVG overlays survive preset/theme/Shuffle re-rolls (they're re-attached on
   *  top), since they're hand-added work rather than part of the generated geometry. */
  addSvgLayer(svg: string): void {
    const id = crypto.randomUUID();
    const subs = this.layer.nodeSubLayers ?? [];
    this.layer.nodeSubLayers = [
      ...subs,
      { id, settings: { ...DEFAULT_NODE_SETTINGS }, svg, svgColorKey: this.visibleSlots()[0], svgScale: 0.5 },
    ];
    // Clear the center so the overlay (e.g. a logo) reads against open space: invert the
    // primary vignette (adding one if the user had cleared them all).
    if (this.vignettes.length === 0) this.vignettes = [defaultVignette()];
    this.vignettes = this.vignettes.map((v, i) => (i === 0 ? { ...v, invert: true } : v));
    this.markCustomized();
    this.selectedSubLayerId = id;
    this.notify();
  }

  /** Remove a sublayer (used for SVG overlays); falls selection back to the parent. */
  removeLayer(id: string): void {
    const subs = this.layer.nodeSubLayers ?? [];
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1) return;
    this.layer.nodeSubLayers = subs.filter((s) => s.id !== id);
    if (this.layer.parentStackIndex && this.layer.parentStackIndex > idx) this.layer.parentStackIndex -= 1;
    if (this.selectedSubLayerId === id) this.selectedSubLayerId = null;
    this.nodeSvgExporters.delete(id);
    this.nodeCanvases.delete(id);
    this.markCustomized();
    this.notify();
  }

  /** Apply a new render stack (bottom-first; null = the parent layer). Settings stay with
   *  their layers — only the stacking changes. */
  reorderStack(order: Array<string | null>): void {
    const subs = this.layer.nodeSubLayers ?? [];
    const byId = new Map(subs.map((s) => [s.id, s]));
    const newSubs = order
      .filter((id): id is string => id !== null)
      .map((id) => byId.get(id))
      .filter((s): s is NodeSubLayer => Boolean(s));
    if (newSubs.length !== subs.length) return;
    this.layer.nodeSubLayers = newSubs;
    const parentIdx = order.indexOf(null);
    this.layer.parentStackIndex = parentIdx === -1 ? 0 : parentIdx;
    this.markCustomized();
    this.notify();
  }

  // ── Exporter / canvas registries ───────────────────────────────────────────

  setNodeSvgExporter(layerId: string, exporter: (() => string) | null): void {
    if (exporter) this.nodeSvgExporters.set(layerId, exporter);
    else this.nodeSvgExporters.delete(layerId);
  }

  setNodeCanvas(layerId: string, canvas: HTMLCanvasElement | null): void {
    if (canvas) this.nodeCanvases.set(layerId, canvas);
    else this.nodeCanvases.delete(layerId);
  }

  // ── Presets & themes ───────────────────────────────────────────────────────

  /** A subtle re-roll of the primary vignette's amount + contrast around their defaults, so
   *  each preset/theme deal feels a little different without ever drifting out of a tasteful
   *  range. The invert toggle and any extra vignette passes are left untouched (deliberate
   *  user choices); if the user cleared all vignettes, the deal stays clear. */
  private shuffleVignette(): void {
    if (this.vignettes.length === 0) return;
    const jitter = (base: number, spread: number) =>
      Math.min(1, Math.max(0, base + (Math.random() * 2 - 1) * spread));
    this.vignettes = this.vignettes.map((v, i) =>
      i === 0
        ? { ...v, amount: jitter(EDGE_FADE_DEFAULT, 0.08), contrast: jitter(EDGE_FADE_CONTRAST_DEFAULT, 0.15) }
        : v,
    );
  }

  /** Palette slots that read against the current background — highlights must never
   *  resolve to the background color or they'd punch invisible holes in the artwork. */
  private visibleSlots(): NodePaletteKey[] {
    const slots: NodePaletteKey[] = ['color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7', 'color8', 'color9', 'color10'];
    const bg = this.palette[this.backgroundColorKey];
    const visible = slots.filter((k) => this.palette[k] !== bg);
    return visible.length > 0 ? visible : slots;
  }

  /** A fresh random highlight set (1-3 passes): random swatch from the slots visible
   *  against the background, a coverage amount, a luma window, and a selection seed (it
   *  decides which eligible elements get the accent). Highlights are luma-driven — they
   *  land on the image's brightest pixels within the window. Each pass uses a tight 5-15
   *  luma window placed in the upper/lighter tones, so the accent reads as a crisp
   *  isoluminance band rather than a broad wash. The first pass targets dots, the rest
   *  flip a coin. Used whenever a layer needs new highlights — preset application + Shuffle. */
  private randomNuances(): NodeNuance[] {
    const visible = this.visibleSlots();
    const count = 1 + Math.floor(Math.random() * 3);
    return Array.from({ length: count }, (_, i) => {
      // Tight band (5-15 wide) in the lighter half of the range, so "light" highlights stay
      // selective: a thin slice of brightness rather than the whole tonal range.
      const width = 5 + Math.floor(Math.random() * 11); // 5–15
      const min = 80 + Math.floor(Math.random() * (240 - 80)); // 80–240
      return {
        id: crypto.randomUUID(),
        target: i > 0 && Math.random() < 0.5 ? 'lines' as const : 'dots' as const,
        // Coverage — fraction of eligible elements recolored (brightest first).
        amount: 0.3 + Math.random() * 0.5,
        colorKey: visible[Math.floor(Math.random() * visible.length)],
        thresholdRange: { min, max: Math.min(255, min + width) },
        seed: Math.floor(Math.random() * 1000),
      };
    });
  }

  /** Randomize the parent layer's image offsets within the slack the cover-fit leaves:
   *  only the axis where the image overflows the viewport can pan without exposing
   *  background, so the offset range is derived from the image/viewport aspect gap.
   *  The image loads async (cached for the canvas anyway); offsets land via notify(). */
  private shuffleImageOffsets(): void {
    const src = this.layer.nodeSource;
    if (!src || !this.layer.nodeSettings) return;
    this.layer.nodeSettings.imageOffsetX = 0;
    this.layer.nodeSettings.imageOffsetY = 0;
    const img = new Image();
    img.onload = () => {
      // The composition may have moved on to another image while this one loaded.
      if (this.layer.nodeSource !== src || !this.layer.nodeSettings) return;
      const [aw, ah] = this.aspectRatio.split(':').map(Number);
      const viewportAr = aw / ah;
      const imageAr = img.naturalWidth / img.naturalHeight;
      // computeFitRect offsets are fractions of the viewport edge; the half-overflow
      // per axis is the largest pan that keeps the viewport fully covered.
      const maxX = imageAr > viewportAr ? (imageAr / viewportAr - 1) / 2 : 0;
      const maxY = imageAr < viewportAr ? (viewportAr / imageAr - 1) / 2 : 0;
      this.layer.nodeSettings.imageOffsetX = (Math.random() * 2 - 1) * maxX;
      this.layer.nodeSettings.imageOffsetY = (Math.random() * 2 - 1) * maxY;
      this.notify();
    };
    img.src = src;
  }

  /** How visually heavy a layer reads: bigger dots dominate, then thicker strokes, then
   *  stroke density. Used to order the render stack — heavier layers sink to the bottom
   *  so finer detail (small dots, thin sparse lines) always draws on top. Each term is
   *  normalized by its slider range so no single parameter swamps the rest. */
  private static boldness(s: NodeSettings): number {
    return (s.dotScale / 5) * 2 + s.lineScale / 5 + s.density / 6000;
  }

  /** Reorder the render stack boldest-first (bottom) per `boldness`. Applied after
   *  generating a composition (presets, Shuffle); the Layer panel's Swap can still
   *  override it by hand afterwards. */
  private sortStackByBoldness(): void {
    const parent = this.layer.nodeSettings;
    if (!parent) return;
    const subs = this.layer.nodeSubLayers ?? [];
    const byId = new Map(subs.map((s) => [s.id, s]));
    const order = computeStack(this.layer)
      .map((id) => ({
        id,
        score: NodeApp.boldness(id === null ? parent : byId.get(id)!.settings),
      }))
      .sort((a, b) => b.score - a.score)
      .map((e) => e.id);
    this.layer.nodeSubLayers = order
      .filter((id): id is string => id !== null)
      .map((id) => byId.get(id)!);
    this.layer.parentStackIndex = Math.max(0, order.indexOf(null));
  }

  /** Replace the composition's settings + sublayer chain with a preset's contents.
   *  Also picks a random sample image, a fresh seed, and fresh random highlights for
   *  every layer, so the same preset gives a new arrangement on each application.
   *  Colors are owned by the active theme, so presets only describe geometry + which
   *  palette slots each element references. */
  applyPreset(preset: Preset): void {
    const randomSeed = () => Math.floor(Math.random() * 1000);
    // User-added SVG overlays aren't part of the preset's geometry — keep them so a new
    // preset never wipes work the user layered on top.
    const svgLayers = (this.layer.nodeSubLayers ?? []).filter((s) => s.svg);
    this.layer.nodeSource = randomSample();
    this.layer.nodeSettings = {
      ...DEFAULT_NODE_SETTINGS,
      ...preset.nodeSettings,
      seed: randomSeed(),
      nuances: this.randomNuances(),
    };
    this.layer.nodeSubLayers = preset.nodeSubLayers.map((s) => ({
      id: crypto.randomUUID(),
      settings: {
        ...DEFAULT_NODE_SETTINGS,
        ...s.settings,
        seed: randomSeed(),
        nuances: this.randomNuances(),
      },
    }));
    this.layer.parentStackIndex = preset.parentStackIndex ?? 0;
    // Boldest layer to the bottom: big dots / heavy strokes never cover fine detail.
    this.sortStackByBoldness();
    // Re-attach SVG overlays on top of the freshly generated stack.
    if (svgLayers.length) this.layer.nodeSubLayers = [...(this.layer.nodeSubLayers ?? []), ...svgLayers];
    this.activePresetName = preset.name;
    // The previous selection's sublayer no longer exists.
    this.selectedSubLayerId = null;
    this.shuffleVignette();
    this.shuffleImageOffsets();
    this.notify();
  }

  /** Swap the global palette + background slot for one of the curated Figma themes.
   *  Everything recolors instantly because dot/line keys resolve against the palette.
   *  Highlights whose slot now matches the new background are remapped to a visible
   *  slot — a highlight must never disappear into the background. */
  applyTheme(theme: Theme): void {
    Object.assign(this.palette, theme.palette);
    this.backgroundColorKey = theme.backgroundColorKey;
    this.themeName = theme.name;
    const visible = this.visibleSlots();
    const bg = this.palette[this.backgroundColorKey];
    const fixNuances = (nuances?: NodeNuance[]): void => {
      nuances?.forEach((nu) => {
        if (this.palette[nu.colorKey] === bg) {
          nu.colorKey = visible[Math.floor(Math.random() * visible.length)];
        }
      });
    };
    fixNuances(this.layer.nodeSettings?.nuances);
    this.layer.nodeSubLayers?.forEach((sub) => fixNuances(sub.settings.nuances));
    this.shuffleVignette();
    this.notify();
  }

  /** A full re-roll for the CMS cover picker: a random curated preset dealt onto a
   *  random color theme (and optionally a fixed aspect ratio). Drawing from
   *  BUNDLED_PRESETS / THEMES means the picker only ever produces on-brand,
   *  studio-grade covers, and any preset added to / removed from the article-cover
   *  generator is reflected here automatically. (The studio's own shuffle button
   *  calls shuffleComposition() directly for fully-random geometry — that path is
   *  intentionally separate.) */
  randomize(aspectRatio?: AspectRatio): void {
    if (aspectRatio) this.aspectRatio = aspectRatio;
    this.applyTheme(THEMES[Math.floor(Math.random() * THEMES.length)]);
    this.applyPreset(BUNDLED_PRESETS[Math.floor(Math.random() * BUNDLED_PRESETS.length)]);
  }

  /** Generate a fully randomized two-layer composition with parameters constrained to
   *  ranges that read well together: the two layers carve complementary luma bands, one
   *  plays a fine/dense role and the other a bold/sparse one, scales contrast, and all
   *  colors come from slots that stay visible against the background. */
  shuffleComposition(): void {
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const ri = (a: number, b: number) => Math.round(r(a, b));
    const chance = (p: number) => Math.random() < p;
    const slots: NodePaletteKey[] = ['color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7', 'color8', 'color9', 'color10'];
    const bgColor = this.palette[this.backgroundColorKey];
    const visible = slots.filter((k) => this.palette[k] !== bgColor);
    const pickVisible = () => visible[Math.floor(Math.random() * visible.length)] ?? 'color9';
    const routings: NodeRouting[] = ['strict', 'free', 'traces', 'flow', 'directional'];

    // Complementary luma bands so the layers sample different parts of the image.
    const split = ri(70, 160);
    const bandA = { min: 0, max: split };
    const bandB = { min: ri(Math.max(40, split - 30), split + 30), max: ri(190, 255) };

    const makeLayer = (band: { min: number; max: number }, role: 'fine' | 'bold'): NodeSettings => {
      const routing = routings[Math.floor(Math.random() * routings.length)];
      return {
        ...DEFAULT_NODE_SETTINGS,
        density: role === 'fine' ? ri(1200, 3500) : ri(400, 1600),
        thresholdRange: band,
        gamma: r(0.6, 2.4),
        dotScale: role === 'fine' ? r(0.7, 1.6) : r(1.8, 3.8),
        lineScale: r(0.8, 3),
        // Strict routing connects every pair in range — keep distances tighter there.
        distance: chance(0.15) ? 0 : routing === 'strict' ? r(2, 9) : r(4, 16),
        grid: chance(0.5),
        routing,
        dirAngle: ri(0, 360),
        dirSpread: ri(20, 130),
        traceBranch: ri(2, 7),
        fill: chance(0.15),
        dotOutline: chance(0.3),
        dotOutlineWidth: r(0.2, 0.9),
        dotColorKey: pickVisible(),
        lineColorKey: pickVisible(),
        nuances: this.randomNuances(),
        seed: ri(0, 999),
        imageOffsetX: 0,
        imageOffsetY: 0,
      };
    };

    // Keep any user-added SVG overlays — Shuffle only re-rolls the generated geometry.
    const svgLayers = (this.layer.nodeSubLayers ?? []).filter((s) => s.svg);
    const fineFirst = chance(0.5);
    this.layer.nodeSource = randomSample();
    this.layer.nodeSettings = makeLayer(bandA, fineFirst ? 'fine' : 'bold');
    this.layer.nodeSubLayers = [
      { id: crypto.randomUUID(), settings: makeLayer(bandB, fineFirst ? 'bold' : 'fine') },
    ];
    // Stack by weight, not by coin flip — the bold layer goes behind the fine one.
    this.sortStackByBoldness();
    // Re-attach SVG overlays on top of the freshly generated stack.
    if (svgLayers.length) this.layer.nodeSubLayers = [...(this.layer.nodeSubLayers ?? []), ...svgLayers];
    this.activePresetName = null;
    this.selectedSubLayerId = null;
    this.shuffleImageOffsets();
    this.notify();
  }

  /** Re-roll EVERY layer's highlights (count, swatch from the full ten-slot palette,
   *  amount, luma band, seed) AND its sampler seed, so tapping the active theme deals a
   *  fresh arrangement just like re-tapping a preset. Base dot/line colors, the
   *  background, and all other geometry settings stay untouched; the applied preset
   *  stays selected. */
  shuffleColors(): void {
    const randomSeed = () => Math.floor(Math.random() * 1000);
    if (this.layer.nodeSettings) {
      this.layer.nodeSettings.nuances = this.randomNuances();
      this.layer.nodeSettings.seed = randomSeed();
    }
    this.layer.nodeSubLayers?.forEach((sub) => {
      sub.settings.nuances = this.randomNuances();
      sub.settings.seed = randomSeed();
    });
    this.shuffleVignette();
    this.notify();
  }
}
