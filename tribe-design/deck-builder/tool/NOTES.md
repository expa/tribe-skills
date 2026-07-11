# deck-builder tool — notes

Author a Tribe deck as JSON, encode it into the site's SlideForge share-URL,
and render it to PDF through the site's own React renderer. Claude writes the
deck JSON directly (this replaces the site's in-app AI generation); the site
does all the visual work.

## Workflow

1. **Author** `deck.json` — `{ "deck": {…}, "slides": […] }`.
   Schema: `reference/slides.ts` (SlideContent) + `reference/deck-config.ts`
   (DeckConfig). Visual reference per layout: `../assets/layout-guide.md`.
   A complete example: `../assets/example-deck.json`.
2. **Encode** → share URL:
   `node encode-deck.mjs deck.json [--base http://localhost:3000]`
   Prints `<base>/handbook/deck-builder/view#<hash>` (hash = base64 of the JSON,
   with data-URL images stripped — same as the site's `share.ts`).
   Roundtrip check / inspect an existing link: `node encode-deck.mjs --decode <url-or-hash>`.
3. **Preview / export — standalone (preferred, no dev server):** open
   `tool/deck.html#<hash>` in any browser, or render a vector-text PDF with
   `render.mjs` — see "Standalone deck.html" below.
4. **Export PDF via the site** (requires the website dev server — `npm run
   dev` in the website repo; do NOT start it yourself unless the user says so:
   local dev talks to the shared production database):
   `node export-deck.mjs deck.json out.pdf [--base http://localhost:3000]`
   One 1280×720 page per slide, 2× raster by default. Only needed when you
   specifically want the site's live cover/canvas figures in the pages.

You can also just hand the user the encoded view URL — it opens as a
keyboard-navigable presentation, and the site's editor can print it.

## Schema quick-reference

Deck (all optional; defaults from `deck-config.ts` are filled in by the encoder):

```json
{ "name": "…", "background": "paper", "eyebrow": "Tribe AI",
  "deckTitle": "running title top-right", "footer": "Tribe AI — Confidential",
  "showFooterLine": true, "showPageNumbers": true, "showLogo": false }
```

Slide — `layout` is required, everything else per-layout (see layout-guide.md):

- `layout`: one of `cover title chapter statement bullets contentImage imageFull grid timeline stats twoColumnDetail feature industry quote agenda logoWall chart textColumns`
- text: `title` `subtitle` `body` `bullets[]` `quote` `attribution` `kicker` `date`
- structure: `items[] { label? title? body? highlight? }`, `columns` (1–5), `chartType` (`bar|paired|line`), `imagePosition` (`left|right`), `imageAspect` (`portrait|landscape|square`)
- media: `imageUrl` `partnerLogoUrl` `logos[]` — hosted http(s) URLs only (data: URLs are stripped from share links)
- style: `accent` (`teal|brown|orange|yellow|ocean`), `background` (per-slide surface), `figure` (+ `figurePaused`, `figureRestPhase`)
- chrome: `eyebrow` `runningTitle` `hide { eyebrow? runningTitle? footer? footerLine? pageNumber? logo? }`
- `source`: editor-only provenance note, never rendered

## Authoring rules (distilled from the site's design-prompt.ts)

- **Brand voice**: editorial and calm, not "techy". Precise, human, unhurried.
  Confidence through restraint. No marketing fluff, no exclamation marks.
- **One idea per slide.** If it's a single strong idea, use `statement`.
- **Text budgets**: titles short and declarative, under ~8 words, no trailing
  punctuation. Bullets 2–6 items, each a tight phrase — never a paragraph.
  Body copy plain and concise.
- **Structure**: slide 1 is always `cover` (title may use `\n`; date = when the
  deck is made, e.g. "JULY 2026") and `cover` is used nowhere else. Decks of
  ~6+ slides get an `agenda` second. `chapter` divides major sections. Vary
  layouts — never all-bullets. End on a `statement` or strong takeaway.
- **Layout fit**: `bullets` only for genuine lists; `quote` for quotations
  (split out the attribution); `grid` for 3–6 named things; `timeline` for
  sequences; `stats` for headline metrics; `chart` for numeric comparisons
  (set `highlight` on the one bar worth calling out); `twoColumnDetail` for an
  approach in named parts; `textColumns` for short prose points side by side.
- **Accent**: default `teal`; vary sensibly across slides (teal/brown/orange/
  yellow). Grid/stats/timeline items auto-cycle per item regardless.
- **Figures**: optional background animation (`figure`), sparingly — a `cover`
  already has the Tusi orbital. For print determinism pair with
  `figurePaused: true`.
- **Facts**: use only facts the user gave (or approved source material). Never
  invent metrics, clients, or quotes; never lorem ipsum. Omit any field you
  don't have real content for — empty fields render nothing.
- Give the deck a short `deckTitle` (running title) — usually the prospect or topic.

## Standalone deck.html

`tool/deck.html` is a self-contained vanilla-JS/CSS port of the site's whole
slide renderer (SlideRenderer + SlideFrame + BarChart + CoverFigure + AutoFit +
DeckViewer + the print rules). It renders all 18 layouts at full fidelity with
NO website, React, or CDN — fonts and logos load relative to the file from
`../../brand/assets/`, so keep it inside the skill folder.

**Open / view:**

- `tool/deck.html#<hash>` — the same share-hash `encode-deck.mjs` produces
  (`--hash-only`). One encoder serves the site link and the standalone file.
- `tool/deck.html?deck=<hash>` — same hash as a query param (what
  `render.mjs --query` appends).
- No hash → a drop zone: drag a `deck.json` in (or pick one); it re-encodes to
  `#<hash>` so the resulting URL is shareable.
- Extra params: `slide=<n>` starts the viewer on slide n (1-based, great for
  per-slide screenshots), `bare=1` hides the page indicator.
- Keys: ArrowRight / Space / PageDown next · ArrowLeft / PageUp prev · `P`
  (or Cmd+P) print.

**Print / PDF (vector text, no dev server):** the full deck is always rendered
off-screen, so printing needs no interaction — Cmd+P from the viewer, or
headless:

```
node ../../scripts/render.mjs --html tool/deck.html \
  --query "deck=$(node tool/encode-deck.mjs deck.json --hash-only)" \
  --pdf deck.pdf --width 1280 --height 720
```

One 1280×720 page per slide (`@page` rules), selectable/embedded-font vector
text — unlike `export-deck.mjs`, which rasterizes the site's render. The page
sets `window.__READY__` (fonts + images + auto-fit + first slide), which
`render.mjs` awaits.

**Fidelity** (verified side-by-side against the site's /view at 1280×720 —
see `../examples/site-slide*.png` vs `standalone-slide*.png`):

- Pixel-identical (differences are text antialiasing only): title, statement,
  bullets, chapter, imageFull, grid, stats, timeline, contentImage,
  twoColumnDetail, feature, industry, quote, agenda, logoWall, textColumns,
  chart (all three chart types ported), plus all deck/slide chrome
  (eyebrow, running title, footer, footer rule, page numbers, logo mark,
  background swatches with the dark-ink override, per-slide `hide` flags).
- Cover: uses the site's STATIC CoverFigure vector composition (the exact
  Figma layers, inlined). The site's /view animates a live canvas Tusi
  instead, so a cover screenshot never matches /view frame-for-frame — the
  static figure is the same one the site uses for thumbnails/print.
- Figures (`slide.figure`): `rose` and `honeycomb` render as static SVG in the
  exact site position/size/color — matching the site's own static
  (thumbnail/print) rendering; on the live site they pulse/build, so a /view
  screenshot shows a partially-drawn curve. The canvas-only figures (`orbit`,
  `sphere`, `symbol`, `whatWeDo`, `partners`) are live-only on the site and
  render NOTHING standalone — pick rose/honeycomb (or none) for decks that
  must print with a figure.
- Deliberate improvement: on dark-ink surfaces (`dark`, `teal`, `ocean`,
  `brown`) the logo mark swaps to `symbol-inverted.svg`; the site draws the
  dark symbol, which is invisible on those surfaces.
- Empty image slots (contentImage / feature / industry) render the site's
  neutral `background-secondary` panel; an empty imageFull falls back to the
  full-ink surface — both look intentional without any hosted image.
- AutoFit (scale-down-to-fit overflow) is ported and runs after fonts/images
  settle, on the viewer slide and on every print slide.

## Caveats

- **The /view route has no print support.** `view/page.tsx` mounts `DeckViewer`
  (one slide at a time, ArrowRight to advance) and does NOT mount `PrintDeck`
  or import `deck-builder.css` (the `@page 1280px 720px` rules) — those exist
  only on the editor route, which can't read a hash. So
  `render.mjs --pdf --url <view-url>` would yield a single default-size page.
  `export-deck.mjs` therefore drives the viewer: screenshots each slide at
  1280×720 (2× scale), then prints the shots to a paged PDF in the same
  headless Chromium. Result: pixel-perfect but **raster** pages (no selectable
  text). For a vector PDF, print from the site's editor UI.
- **Dev server required, and it's shared-state**: `npm run dev` in the website
  repo talks to the shared production Neon DB. Viewing /view is read-only and
  safe, but don't start/leave servers running or create content without the
  user's say-so.
- **Images**: `data:` URLs are stripped by the encoder (exactly like the site's
  share links). Use hosted URLs; anything the dev server can fetch renders.
  Very long URL hashes are fine for headless Chromium but keep decks sane.
- **Hash decodes client-side**: /view reads `location.hash` in a `useEffect`,
  so allow settle time after load (`export-deck.mjs` defaults `--wait 2500`).
  "Nothing to show" means the hash didn't decode — validate your JSON.
- **Live figures**: canvas figures animate on /view; an unpaused figure is
  captured mid-motion. `rose`/`honeycomb` are the only figures that render in
  the site's own thumbnails/print paths.
- **AutoFit**: SlideFrame scales overflowing content down rather than clipping
  — an over-stuffed slide silently shrinks its type. Respect the text budgets
  instead of relying on it.
- `reference/` holds verbatim copies of the site sources (slides.ts,
  deck-config.ts, design-prompt.ts, share.ts, library.ts, deck-builder.css) —
  library.ts is a good gallery of on-brand per-layout copy. If the site's
  schema changes, re-copy these and re-check `encode-deck.mjs` against
  `share.ts`.
