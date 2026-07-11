# SlideForge layout guide

The 18 slide layouts of the Tribe deck builder, as rendered by the site's
`SlideRenderer.tsx` inside a fixed **1280×720** frame (`SlideFrame.tsx`).
Author each slide as a `SlideContent` JSON object (schema: `tool/reference/slides.ts`).
Empty/omitted fields render nothing — never write placeholder text.

Type roles you'll see referenced: **serif** = Tribe Serif light (headlines),
**sans** = Tribe Sans light (body), **caption** = Tribe Caption, uppercase +
tracked (labels, eyebrows, numbers).

## Shared slide chrome (every non-cover layout)

`SlideFrame` wraps the layout content with deck-level chrome:

- Top-left: **eyebrow** (caption, e.g. "Tribe AI") — from `deck.eyebrow`, per-slide override via `slide.eyebrow`.
- Top-right: **running title** (caption) — from `deck.deckTitle`, per-slide override via `slide.runningTitle`. If the deck's **logo mark** is on (`deck.showLogo` / per-slide `hide.logo: false`), the Tribe symbol takes this slot instead.
- Bottom-left: **footer** text (`deck.footer`, e.g. "Tribe AI — Confidential") above nothing; bottom edge has a hairline **footer rule** (`deck.showFooterLine`).
- Bottom-right: **page number** `NN / NN` (`deck.showPageNumbers`).
- Content sits inside `px-16 py-28` padding and is auto-fit (scaled down) so it never overflows — but don't rely on that; respect text budgets.

Per-slide chrome fields on `SlideContent`:

| Field | Type | Effect |
|---|---|---|
| `background` | SlideBackground id | Surface override for this slide (undefined = deck default). Dark surfaces auto-flip ink to light. |
| `accent` | `"teal" \| "brown" \| "orange" \| "yellow" \| "ocean"` | Tints the layout's accent elements (bullet numbers, chapter kicker, quote mark). Default `teal`. |
| `figure` | FigureId | Background canvas animation, top-right, behind content. |
| `figurePaused` | boolean | Freeze the figure to a static frame. |
| `figureRestPhase` | number (deg) | The pose a paused figure settles to. |
| `eyebrow` / `runningTitle` | string | Override deck chrome text on this slide only. |
| `hide` | `{ eyebrow?, runningTitle?, footer?, footerLine?, pageNumber?, logo? }` | Hide (or for `logo`/`footerLine`, force-toggle) a chrome element on this slide. |
| `source` | string | Editor-only provenance note ("Case study — Acme"); never rendered. |

Alignment behavior: hero layouts (`title`, `statement`, `chapter`, `quote`,
`contentImage`, `feature`) center vertically; header+content layouts
(`bullets`, `grid`, `stats`, `timeline`, `twoColumnDetail`, `industry`,
`logoWall`, `chart`, `textColumns`) anchor to the top. `stats`, `timeline`, `logoWall`,
`chart` fill the full height (content distributes top→bottom). `cover`,
`imageFull`, and `agenda` compose their own full frame (no standard chrome;
`agenda` still honors the background + logo mark).

---

## The 18 layouts

### 1. `cover` — branded opening cover
Full-bleed, no chrome. Tribe logo lockup (symbol + wordmark) top-left, the
animated Tusi orbital figure filling the right side, and bottom-left a very
large serif headline (80px, `\n` breaks lines) with a small uppercase date
label under it.
- Fields: `title` (string, may contain `\n`), `date` (string, e.g. `"JULY 2026"`), `partnerLogoUrl` (string URL — renders "Tribe ×  Partner" lockup), `accent`.
- Use: the FIRST slide of every deck, never anywhere else. Date the cover to when the deck is made.

### 2. `title` — section title
Vertically centered: big serif title (7xl, ~72px) with an optional lighter
sans subtitle below.
- Fields: `title`, `subtitle`.
- Use: an opening or section-intro slide when a chapter number feels too heavy.

### 3. `chapter` — section divider
Centered stack: a huge accent-colored serif kicker (140px — "01", "Part One"),
then a 6xl serif chapter title, then an optional muted subtitle.
- Fields: `kicker` (the numeral/label), `title`, `subtitle`, `accent`.
- Use: divide major sections of longer decks. Number them "01", "02", …

### 4. `statement` — one bold idea
A single 6xl serif line, centered vertically, max-width ~5xl; optional smaller
muted supporting paragraph below.
- Fields: `title` (the statement), `body` (supporting line), `accent`.
- Use: a single strong idea or takeaway. Also a strong closing slide.

### 5. `bullets` — heading + numbered list
5xl serif heading, then a list where each item gets an accent-colored
two-digit number ("01", "02", …) beside light sans text. Lays out in 1–5
columns (text shrinks as columns grow).
- Fields: `title`, `bullets` (string[], 2–6 tight phrases), `columns` (1–5, default 1), `accent`.
- Use: genuinely list-shaped content only. Don't make every slide bullets.

### 6. `contentImage` — text beside an image
Horizontally split: 5xl serif heading + xl sans body on one side, a 4:3
rounded image (44% width) on the other.
- Fields: `title`, `body`, `imageUrl`, `imagePosition` (`"left" | "right"`, default right).
- Use: one point that benefits from an image. Note: data-URL images are stripped from share links — use hosted (http) URLs only.

### 7. `imageFull` — full-bleed image with overlay
Full-bleed image (or solid dark surface when no image) with a dark gradient
rising from the bottom; 6xl serif title + subtitle overlaid bottom-left in
light ink. No chrome.
- Fields: `title`, `subtitle`, `imageUrl`.
- Use: image-led moment or dramatic section break. Without `imageUrl` it renders a plain dark slide — fine as a bold interstitial.

### 8. `grid` — accent card grid
5xl serif heading over a grid of rounded, accent-FILLED cards (bg cycles
teal → brown → orange → yellow per card, text in the contrast color). Each
card: small index number, serif card title, small sans body.
- Fields: `title`, `items` (`{ title, body }[]`, 3–6), `columns` (1–5, default = item count up to 3).
- Use: features, values, offerings — a set of named things. The most colorful layout; use sparingly.

### 9. `timeline` — ordered milestones
5xl serif heading; below, a horizontal hairline with an accent dot per
milestone (colors cycle), each with an uppercase caption label ("Week 1"),
serif title, and small body. Up to 5 shown, evenly spaced.
- Fields: `title`, `items` (`{ label, title, body }[]`, 3–5).
- Use: phases, roadmap, engagement plan — anything sequential.

### 10. `stats` — headline metrics row
5xl serif heading at top; metrics anchored toward the bottom half. Each
metric: a giant serif number (8xl, accent color cycling per item) over a small
muted label. Max 4 shown.
- Fields: `title`, `items` (`{ title: "3×", body: "its label" }[]`, 2–4).
- Use: impact/results. Numbers must be real — never invent metrics.

### 11. `twoColumnDetail` — headline + named parts
38%-wide left column with 5xl serif headline (+ optional intro body); right
side a 2-column grid of titled text blocks (serif 2xl subhead + sans body).
- Fields: `title`, `body` (intro), `items` (`{ title, body }[]`, ideally 2 or 4).
- Use: explaining an approach/method in a few named parts.

### 12. `feature` — headline, hero image, side notes
Three columns: narrow left (5xl serif title + intro body, 24% width), a large
rounded image centered in the middle (portrait 3:4 / landscape 16:10 /
square), and a narrow right column of up to 3 short titled notes
bottom-aligned to the image.
- Fields: `title`, `body`, `imageUrl`, `imageAspect` (`"portrait" | "landscape" | "square"`, default portrait), `items` (`{ title, body }[]`, 1–3 notes).
- Use: a flagship point with strong imagery.

### 13. `industry` — segment overview
Left: 5xl serif title, muted 3xl serif subtitle, two sans body columns
(`items[0].body`, `items[1].body`), and a client-logo row pinned to the
bottom. Right: a tall (456px) rounded image, 38% width.
- Fields: `title`, `subtitle`, `items` (exactly 2, each `{ body }`), `logos` (string[] of image URLs), `imageUrl`.
- Use: an industry/segment overview slide.

### 14. `quote` — pull quote
A large accent-colored serif opening quote mark, then the quote in 4xl serif,
then a small uppercase caption attribution.
- Fields: `quote`, `attribution` (e.g. `"— Name, Title, Company"`), `accent`.
- Use: testimonials and quotations. Never invent quotes.

### 15. `agenda` — deck outline ("Part I / II / III")
Self-composed editorial frame: 7xl serif title pinned top-left; on the right
(52% width), a vertical list where each item gets an uppercase "Part I/II/III"
caption label beside a 32px serif section title and an optional one-line muted
detail. Up to 6 items.
- Fields: `title` (usually "Agenda"), `items` (`{ title, body? }[]`, 3–6; titles may contain `\n`).
- Use: the SECOND slide of decks with ~6+ slides.

### 16. `logoWall` — client/partner logos
5xl serif title (+ optional muted serif subtitle) at top; a grid of logos
(max-height 64px each, up to 4 columns) anchored to the bottom.
- Fields: `title`, `subtitle`, `logos` (string[] of hosted image URLs).
- Use: social proof. Leave `logos` empty unless you have real logo URLs (empty = heading only).

### 17. `chart` — bar / paired / line chart
5xl serif heading at top; the chart fills the lower ~74% of the slide; an
optional small right-aligned source caption below it. Each `items` entry is a
data point: `label` = the category ("Q1"), `title` = the value ("40");
`highlight: true` accents one bar. `chartType: "paired"` and `"line"` read
`item.body` as a second value. Up to 8 points.
- Fields: `title`, `items` (`{ label, title, body?, highlight? }[]`, 2–8), `chartType` (`"bar" | "paired" | "line"`, default bar), `body` (source caption).
- Use: comparing numeric values (quarters, segments, before/after). Real numbers only.

### 18. `textColumns` — prose columns
5xl serif heading over 1–4 columns of plain sans paragraphs — the `bullets`
array, one paragraph per entry, NO bullet markers.
- Fields: `title`, `bullets` (string[], one short paragraph each), `columns` (1–4, default 2).
- Use: a few short prose points that sit side by side without feeling like a list.

---

## SLIDE_BACKGROUNDS (deck.background / slide.background)

| id | label | hex | ink |
|---|---|---|---|
| `paper` | Paper | `#FAFAF8` | dark (default) |
| `soft` | Soft | `#F4F4F2` | dark |
| `white` | White | `#FFFFFF` | dark |
| `sand` | Sand | `#EBEBE2` | dark |
| `dark` | Ink | `#06141B` | light `#FAFAF8` |
| `cyan` | Cyan | `#65D9EE` | dark |
| `teal` | Teal | `#0A99C3` | light |
| `ocean` | Ocean | `#0D4E6E` | light |
| `orange` | Orange | `#FF7C0F` | dark |
| `yellow` | Yellow | `#FEDE59` | dark |
| `brown` | Brown | `#AD5913` | light |

Default deck background is `paper`. Neutral papers for most slides; a colored
`background` on a `chapter` or `statement` slide makes a strong section break.

## FIGURES (slide.figure)

Background canvas animations, drawn top-right behind content:

| id | what it is |
|---|---|
| `orbit` | the cover's dense Tusi orbital |
| `sphere` | homepage hero's tilted wireframe sphere |
| `symbol` | Tribe mark drawn by Fourier epicycles |
| `whatWeDo` | homepage "what we do" Tusi figure |
| `partners` | homepage partners rose |
| `rose` | lissajous rose, pulsing |
| `honeycomb` | lissajous honeycomb, building |

Note: `rose` and `honeycomb` also render static in thumbnails/print; the
canvas-based ones (`orbit`, `sphere`, `symbol`, `whatWeDo`, `partners`) appear
on live surfaces only — in the headless PDF export they ARE captured (the
viewer is a live surface) but a moving figure lands on whatever frame the
screenshot catches. Set `figurePaused: true` (+ optional `figureRestPhase`)
for a deterministic pose. Use figures sparingly — one per section at most.

## Accent use

- Accents: `teal | brown | orange | yellow` (+ `ocean` when grounded source material calls for it). Default `teal`.
- Vary `accent` sensibly across slides — don't paint the whole deck one color, but don't rainbow every slide either. Teal is home base; brown/orange/yellow punctuate.
- Multi-item layouts (`grid` cards, `stats` numbers, `timeline` dots) ignore the slide accent and cycle teal → brown → orange → yellow per item automatically.
