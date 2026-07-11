# Diagram tool — schema + authoring notes

Pure-Node CLI that turns a diagram JSON (nodes + edges) into a finished
Tribe-branded SVG/PNG. Claude authors the JSON directly; a deterministic layout
engine does the pixel positioning. The lib is a plain-ESM port of the website's
`lib/diagram/*` (originals in `reference/` for diffing).

## CLI

```
node tool/diagram.mjs <input.json> [--out out.svg] [--png out.png] [--scale 2]
```

- `--out` defaults to `<input>.svg` next to the input.
- `--png` rasterises via headless Chromium (spawns `../../scripts/render.mjs`;
  needs playwright-core installed there — `npm install` in `scripts/` — plus a
  Chromium/Chrome, see render.mjs header).
- `--scale` PNG device scale factor (default 2).

Pipeline: read JSON → `sanitizeDiagram` (drops malformed nodes/edges, clamps
values) → `autoLayout` (skipped when ALL nodes carry x/y — see Layout below) →
`diagramToSvg` → write SVG → optional PNG.

## Diagram JSON

```json
{
  "title": "optional, not rendered — just metadata",
  "background": "#FAFAF8",
  "exportBackground": true,
  "cornerRadius": 8,
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

Diagram fields:
- `background` — canvas colour (hex). Default paper `#FAFAF8`.
- `exportBackground` — bake the background into the export (default `false` =
  transparent SVG/PNG).
- `cornerRadius` — rounding of arrow bends in px, 0–24 (0 = sharp 90° corners).

### Node

```json
{ "id": "api", "label": "API Gateway", "subLabel": "auth + routing",
  "shape": "rounded", "color": "brand", "textAlign": "center" }
```

- `id` (required) — short unique string; edges reference these.
- `kind` — `"node"` (default) or `"badge"` (a fixed 40×40 numbered circle).
- `label` — 1–4 words; `\n` forces line breaks.
- `subLabel` — optional secondary line, smaller + lighter.
- `textAlign` — `left | center | right` (default `center`).
- `shape` — `rounded | rect | pill | diamond | ellipse`.
- `color` — `default | brand | teal | ocean | brown | orange | yellow | dark`.
- `x, y, w, h` — optional absolute geometry (canvas is 4000×2800); see Layout.
- Badge only: `parentId` (node it snaps to) + `anchor`
  (`tl | tc | tr | rc | br | bc | bl | lc` — 4 corners + 4 edge centres). A
  snapped badge needs no x/y; a floating badge does.

Palette (fill / text): `default` white/ink, `brand` cyan #65D9EE / deep teal,
`teal` #0A99C3, `ocean` dark blue #0D4E6E, `brown` #AD5913, `orange` #FF7C0F,
`yellow` #FEDE59, `dark` ink #06141B / paper. Contrast text is picked
automatically per key.

### Edge

```json
{ "id": "e1", "from": "api", "to": "db", "label": "reads/writes",
  "dashed": true, "endCap": "triangle" }
```

- `from`, `to` (required) — node ids; self-loops and unknown ids are dropped.
- `label` — short; rendered as an uppercase chip at the line's midpoint.
- `dashed` — secondary/async flows.
- `bold` — thicker line (2.5px vs 1px).
- `color` — palette key for line + caps (default: warm tan `#C7BDB2`).
- `startCap` (default `none`) / `endCap` (default `triangle`) —
  `none | arrow | triangle | inv | circle | dot | diamond`.
- `labelColor` / `labelBorder` — chip palette + outline.
- `labelT` — 0–1 position of the label along the arrow (default 0.5).
- `fromSide` / `toSide` — pin which side (`top | right | bottom | left`) the
  arrow leaves/enters; omit for auto.
- `waypoints` — `[{x, y}, …]` absolute canvas points the route is forced
  through (only meaningful with manual layout; auto-layout drops them).

## Layout

- **Auto (recommended, the default):** omit x/y/w/h everywhere. Nodes are sized
  to fit their text, ranked into layers along the flow, ordered to reduce edge
  crossings, and placed with generous gaps; orientation (left-to-right vs
  top-to-bottom) is picked automatically. The ORDER of nodes/edges in the JSON
  is a layout hint — list them in natural flow order.
- **Manual:** give EVERY node numeric `x` and `y` (badges snapped via
  parentId+anchor are exempt) and autoLayout is skipped entirely. Supply `w`/`h`
  too — missing sizes fall back to 180×72 regardless of text length, so long
  labels can overflow. Mixed input (some nodes placed, some not) triggers a
  FULL auto-layout: manual coordinates are ignored.

## Authoring guidance (from the site's generator prompt)

- Shapes convey meaning: `rounded` services/components (default), `rect` data
  stores/files, `pill` start/end/external actors, `diamond` decisions,
  `ellipse` events/signals/abstract concepts.
- Color SPARINGLY: most nodes `default` (white); accents only to group or
  highlight; at most 2–3 accent colors per diagram.
- Label edges only when it clarifies the relationship ("reads/writes",
  "publishes"); `dashed: true` for secondary/async flows.
- Aim for 4–14 nodes. Labels are diagram captions, not prose.
- Badges (`kind: "badge"`) are numbered callouts — snap them to a parent corner
  (`anchor: "tr"` is typical) to annotate steps.

## Caveats

- Text metrics are char-width estimates (no DOM), so extreme labels can wrap
  slightly differently than the site editor; keep labels short.
- `title` is accepted but not rendered into the SVG.
- Node `image` / `imageMode` exist in the model but data-URL images are a
  site-editor feature; not intended for CLI authoring.
- Two small CLI additions over the site's `sanitizeDiagram` (marked in
  `lib/model.mjs`): `textAlign` and `labelT` pass through sanitization so they
  are usable from authored JSON (the site editor sets them post-sanitize).
- PNG export requires Chromium; SVG export has zero dependencies.
- The export viewBox hugs the content + 48px margin; the canvas size only
  matters as a coordinate space for manual layouts (keep within 4000×2800 —
  values are clamped).
