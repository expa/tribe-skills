# node-cover.html — Tribe article-cover generator (headless harness)

Standalone vanilla-JS port of the website's node-generator
(`website/app/components/node-generator/` — originals copied verbatim into
`reference/`). Renders generative node/dot/trace artwork to a single canvas,
driven entirely by URL params. Exports stills (PNG via `scripts/render.mjs`,
SVG via `window.exportSvg()`) and the animated "wash" reveal (WEBM).

## URL params

| Param | Values | Default | Notes |
|---|---|---|---|
| `preset` | preset name (see below) or `random` | seeded-random pick | Name matching is case/space/dash-insensitive (`sparse-traces` = `Sparse traces`). |
| `theme` | theme name (see below) or `random` | seeded-random pick | Colors are owned by the theme; presets only reference palette slots. |
| `settings` | URI-encoded JSON | — | Partial override, applied after the preset. See "settings JSON" below. |
| `image` | path (relative to this file) or URL, or `none` | none | Source photo to luma-sample. Without one, a seeded procedural luma field stands in (deterministic; this is a harness addition, the app always uses a photo). |
| `ratio` | `1:1` `3:2` `2:3` `16:9` `9:16` | `3:2` | Frame aspect. |
| `seed` | integer | `0` | Master seed: drives preset/theme picks (when unset), per-layer sampler seeds, nuance highlights, vignette jitter, image pan, wash origin. Same params + same seed = identical output. |
| `size` | px | `1600` | Longest canvas edge (internal resolution). |
| `animate` | `0` `1` | `0` | `1` loops the wash reveal (lead 260ms → sweep 2400ms → tail 480ms → 600ms hold → restart; one cycle = 3.74s). |
| `origin` | `x,y` (0-1 fractions) | seeded random | Wash origin (animate only). |
| `jitter` | 0-1 | `0.3` | Raggedness of the wash front (animate only). |
| `direction` | `out` `in` | `out` | Wash spreads from the origin, or converges onto it. |

`window.__READY__` is a Promise that resolves after the still is painted (for
`animate=1`, once the loop has started) — `render.mjs` awaits it automatically.
`window.__COMPOSITION__` exposes the resolved preset/theme/settings for debugging.

### settings JSON

Two shapes, auto-detected:

1. **Parent-layer partial** (no composition keys): merged into the parent
   layer's NodeSettings, e.g.
   `{"routing":"directional","dirAngle":45,"distance":14,"dotColorKey":"color1"}`
2. **Composition-level** (any of these keys present):
   - `nodeSettings` — partial merge into the parent layer
   - `nodeSubLayers` — `[{settings:{…}}, …]` REPLACES the preset's sublayers
     (each merged over defaults)
   - `parentStackIndex` — parent's position in the bottom-first render stack
   - `vignettes` — `[{amount:0.2, contrast:0.5, invert:false}, …]` (replaces;
     `[]` disables the edge fade)
   - `palette` — partial hex overrides for `color1`…`color10`
   - `backgroundColorKey` — which slot paints the background
   - `elementScale` — 0-1 global dot/line shrink

NodeSettings fields (see `reference/types.ts` for docs): `density`,
`thresholdRange:{min,max}` (0-255 luma band), `gamma`, `dotScale`, `lineScale`,
`distance` (0 = no traces), `grid`, `routing`
(`strict|free|traces|flow|directional`), `dirAngle`, `dirSpread`, `traceBranch`,
`fill`, `dotOutline`, `dotOutlineWidth`, `dotColorKey`, `lineColorKey`,
`nuances` (array of `{target:'dots'|'lines', colorKey, amount, thresholdRange,
seed}`), `seed`, `imageOffsetX/Y`. Explicit `nuances` / `seed` in an override
pin them (otherwise both are re-rolled from the master seed, matching the app's
applyPreset behavior).

## Presets (BUNDLED_PRESETS)

- **Stipple flow** — dense dark-band stipple grid over a flow-routed mid-band mesh.
- **Sparse traces** — filled trace webs with outlined dots on the bright band, over a coarse grid of big dots.
- **Grid flow** — light strict-grid lattice over a heavy horizontal flow band.
- **Trace weave** — grid trace weave with a directional outlined-dot band.
- **Mosaic** — free-routed big-dot grid over a filled strict-grid band (anisotropic strict lines read as horizontal runs).
- **Ember grid** — fine bright-band strict stipple over a coarse band of big dots.
- **Clay traces** — outlined trace dots over a filled trace band.
- **Pool drift** — loose free-routed dot drift over a directional outlined band.
- **Amber drift** — Pool drift's warmer sibling with amber nuances.

## Themes (ground color)

Pool (light cyan) · Lagoon (cyan) · Brand (brand cyan) · Teal · Ocean (deep blue)
· Yellow · Solar (gold) · Orange · Terra (peach) · Clay (caramel) · Brown ·
Ember (rust) · Sand (taupe).

## Sample images

`samples/` has 6 of the site's 26 sample photos (dunes.jpg, sandstone.jpg,
glass-orb.webp, poppies.webp, ribbons.webp, voxel-tunnel.webp). The full set
lives in the website repo at `website/public/node-generator/samples/`.

## Example commands

From `tribe-skills/tribe-design/`:

```sh
# Still, procedural field (no image)
node scripts/render.mjs --html article-cover/tool/node-cover.html \
  --query 'preset=stipple-flow&theme=lagoon&seed=42&size=1600' \
  --selector canvas --out cover.png --width 1200 --height 800

# Still sampled from a photo, 16:9
node scripts/render.mjs --html article-cover/tool/node-cover.html \
  --query 'preset=grid-flow&theme=sand&image=samples/poppies.webp&ratio=16:9&seed=3' \
  --selector canvas --out cover.png --width 1200 --height 675

# Settings override (parent-layer partial)
node scripts/render.mjs --html article-cover/tool/node-cover.html \
  --query "seed=9&ratio=1:1&settings=$(node -e 'console.log(encodeURIComponent(JSON.stringify({routing:"directional",dirAngle:45,distance:14})))')" \
  --selector canvas --out cover.png --width 900 --height 900

# Animated wash reveal → WEBM (one cycle ≈ 3.74s)
node scripts/render.mjs --html article-cover/tool/node-cover.html \
  --query 'preset=stipple-flow&theme=lagoon&seed=42&animate=1' \
  --webm cover.webm --duration 3800 --width 1200 --height 800

# SVG export (playwright one-liner pattern)
#   await page.goto(fileUrl + '?preset=…'); await page.evaluate(() => window.__READY__);
#   const svg = await page.evaluate(() => window.exportSvg());
```

## Caveats

- **PNG resolution**: `render.mjs` screenshots the canvas at its CSS size ×
  `--scale` (default 2), not at `?size`. For a ~2400px-wide export use
  `--width 1200 --height 800` (3:2) with the default scale. `?size` sets the
  internal render resolution; keep it ≥ the screenshot size for sharpness.
- **file:// image sampling** needs Chromium's `--allow-file-access-from-files`
  (canvas taint). `scripts/render.mjs` now passes it. If an image can't be
  sampled or fails to load, the harness logs a console error and falls back to
  the procedural field rather than rendering blank.
- **Procedural field** (no `?image=`) is a harness addition — the app always
  samples a photo. It's a seeded fBm noise + gradient stretched to the full
  0-255 range so every preset's threshold bands find structure.
- **Randomness semantics**: like the app, applying a preset re-rolls per-layer
  sampler seeds and nuance highlights — here from the master `?seed`, so output
  is deterministic. The preset files' authored `nuances` are therefore NOT what
  renders (same as the live app); pin nuances via `?settings` if you need exact
  ones.
- **Aspect-ratio anisotropy in routing** is faithful to the app: distances are
  measured in normalized sample-map space, so on wide frames strict/directional
  edges connect more readily along X than Y (visible in e.g. Mosaic).
- **WEBM capture** records the page in real time from load; the loop's hold
  frame (finished artwork) fills any leftover duration. For a clean single
  reveal use `--duration 3800`.
- **Not ported** (not needed headlessly): user-uploaded SVG overlay layers
  (`svgLayer.ts`), clipboard/zip/download plumbing (`export.ts` UI paths), the
  2160p renderScale bump (use `?size` instead), and the React studio UI.
