# Doc generator — document data reference

A document is one JSON file:

```json
{
  "config": {
    "title": "about-tribe",
    "meta": {
      "docLabel": "About Tribe",
      "date": "July 2026",
      "footerText": "www.tribe.ai",
      "confidential": false
    }
  },
  "blocks": [ … ],
  "paginate": false
}
```

- `config.title` — short; becomes the exported file name (slugified).
- `meta.docLabel` — small uppercase label in the sheet's top-right corner.
- `meta.date` — top-right, under the label. Only if the document implies one.
- `meta.footerText` — bottom-right (default `www.tribe.ai`).
- `meta.confidential: true` — prints "Confidential — do not distribute"
  bottom-left.
- `paginate` (export API only): `false`/omitted = one continuous artboard
  page sized to the content; `true` = real A4 pages, the masthead/footer
  chrome repeating on every printed page. Use `true` beyond ~1 sheet.
- The sheet renders the Tribe symbol top-left automatically. A4 width
  (794px), paper background, brand fonts — all automatic.

## Fields every block can carry

| Field | Values | Notes |
|---|---|---|
| `type` | one of the 12 below | required |
| `width` | `"full"` (default) \| `"half"` | two consecutive halves sit side by side |
| `accent` | `"teal"` \| `"brown"` \| `"orange"` \| `"yellow"` \| `"ocean"` | tints numerals/stat figures on section, numbered, cards, stats |
| `id` | string | omit when authoring — the app assigns one. Keep existing ids when revising an exported file |

Omit any field you have no real content for — empty fields render nothing.
Plain text only; `\n\n` in `body` makes a paragraph break. List caps:
`bullets` ≤ 8, `items` ≤ 12, `images` ≤ 12, `columns` 1–4.

## Block types

### `header` — the masthead. Use once, first.
`eyebrow` (small uppercase label, e.g. "About Tribe") · `title` (large
serif-light, ~38px — the document's one big claim) · `subtitle` (lede line,
muted).

### `section` — starts a section.
`eyebrow` · `title` (serif-light 26px) · `body` (optional intro paragraph) ·
`accent`. Give each major section its own accent and keep that accent for
the section's item-grids.

### `text` — body copy.
`body` only. One or more paragraphs separated by `\n\n`. 15px sans-light.

### `statement` — a breather between dense sections.
`title` (the statement, serif 26px, centered on a tinted panel) · `body`
(optional supporting line). One strong idea, stated plainly.

### `bullets` — tight bullet list.
`bullets`: array of 2–6 short strings. Renders with a thin left rule per
item, no discs.

### `numbered` — steps / interventions in a grid.
`items` (each `{ "title", "body", "label"? }` — numerals `01, 02…` are
automatic; `label` overrides one) · optional `eyebrow` + `title` heading ·
`columns` (2–3, default 3) · `accent` (tints the numerals).

### `cards` — tinted panels in a row.
`items` (each `{ "title"?, "body", "label"? }`; the auto-numeral label shows
above) · optional `eyebrow` + `title` heading · `columns` (usually 2) ·
`accent`. Good for customer stories and examples.

### `list` — hairline-divided rows.
`items` (each `{ "title", "body" }`) · optional `eyebrow` + `title` heading ·
`layout`: default puts title left / description right (180px label column);
`"stacked"` puts title above description. Good for capabilities, skills,
offerings.

### `stats` — headline metrics.
`items` (each `title` = the number, e.g. `"3x"`, `"47%"`, `"35 min"`
(serif-light 34px in the accent color) and `body` = its label) · optional
heading · `columns` (2–4) · `accent`. Only real metrics.

### `quote` — pull quote.
`quote` (serif, left-ruled) · `attribution` (`"Name, Title, Company"`).

### `image` — one or more images.
`images`: array of URLs (hosted https or data URLs) · `caption` (optional) ·
`layout`: `"row"` packs all on one line, sized to fit and vertically
centered — **the logo-bar treatment**; otherwise a grid via `columns`
(1 = stacked full-width, 2–4 = grid, rounded corners) · `tint`: `"ink"`
(near-black) or `"light"` (muted) renders each image as a single-color
mark — use for mixed-color logo sets so they read as one quiet set.
Client/partner logos live in the CMS media library (Blob URLs); in the
editor humans can also upload or pick from the library, so leaving
`images: []` with a caption is a valid "slot" for them to fill.

### `divider` — a hairline rule.
No fields. Use to separate sections when a `section` header is too much.

## Layout & rhythm rules

- Item-grid blocks (`numbered`, `cards`, `stats`) already lay out in
  columns — keep them `"full"` width.
- Pair `"half"` blocks for side-by-side content: e.g. a `text` column next
  to a stacked `list`, or two related `cards` runs. Both halves must be
  consecutive in the array.
- Never two item-grid blocks back to back; separate with `text`,
  `statement`, or `divider`.
- Vary accents per section; default `teal`.

## Editing round-trip

The editor at `/handbook/doc-generator` autosaves to the browser,
**Import data** loads a `.json` like the above, **Export data** downloads
the current document in the same shape (with block `id`s — keep them if you
revise it, so a future import preserves identity). **Export PDF** in the
editor equals the API call in the GUIDE.
