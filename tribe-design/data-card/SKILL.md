---
name: tribe-design-data-card
description: Generate on-brand Tribe chart images from structured data, including bar charts, line charts, titles, sources, and logos. Use for standalone Tribe data cards or charts embedded in presentations, documents, reports, social graphics, and web content.
---

# Tribe Design — Data Card

On-brand chart images from structured data — bar or line charts with optional
title, eyebrow, helper/source line, and logo. Omit the text/logo params for a
pure chart to embed in a slide or document. **Read `../brand/SKILL.md` first.**

## The generator

`tool/data-card.html` is a runnable port of the website's data-card studio:

```sh
node ../scripts/render.mjs \
  --html tool/data-card.html \
  --query "params=$(node -e 'console.log(encodeURIComponent(JSON.stringify({
    chart: "bar", format: "16:9", surface: "paper", accent: "teal",
    eyebrow: "Research", title: "Time to production, weeks",
    helper: "Source: Tribe engagements 2024–2025",
    data: "Traditional, 34\nWith Tribe, 9"
  })))')" \
  --selector canvas --out chart.png --width 1700 --height 1200 --scale 1
```

**`tool/NOTES.md` is the full reference** — formats (`1:1` 1080², `16:9`
1600×900, `4:5` 1080×1350), the data-string grammar, and caveats. Read it
before rendering.

### Data format

One series-point per line: `Label, Value[, Value…]`. Extra values create
grouped bars / multiple lines, colored by the accent cycle (chosen accent
first). A `(Custom)` suffix on a value overrides its printed label. Units in
the value ("34%", "$1.2M") are carried through.

## Choosing well

- **Numbers are the hero** — keep series count ≤ 3 and labels short; the chart
  should read in two seconds.
- **Pure chart mode**: pass empty `eyebrow`/`title`/`helper` and
  `logo: "none"` to get just the plot for embedding in decks/documents.
- **Always cite**: when the card stands alone, put the source in `helper`.
- Surfaces/accents follow the same rules as social cards: paper default, ink
  for drama, one accent (it leads the series cycle), ink eyebrows.

## Examples

`examples/data-bar.png` (16:9 grouped bars, two series) and
`examples/data-line.png` (1:1 ink surface, two lines) are verified renders —
compare before delivering.

## Don'ts

❌ Rainbow series colors (accent cycle only) · ❌ gridline clutter (baseline
hairline only) · ❌ 3D, gradients, zebra fills · ❌ unreadable label crowding —
aggregate instead · ❌ uncited standalone stats.
