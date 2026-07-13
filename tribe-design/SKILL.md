---
name: tribe-design
description: >-
  Tribe AI's complete design system for creating any branded artifact — brand
  identity (colors, fonts, logos), writing voice, and runnable generators for
  social cards, data/chart cards, article covers, the Tusi orbital animation,
  slide decks, system diagrams, documents, and website pages. Use whenever
  making, reviewing, or exporting ANYTHING for Tribe: a social graphic, OG
  image, quote card, chart, presentation, pitch deck, proposal, one-pager,
  report, diagram, flowchart, article, cover art, video background, web page,
  or copy in the Tribe voice. Triggers on "Tribe brand", "on-brand", "make a
  deck", "social card", "data card", "chart image", "article cover", "Tusi",
  "animation export", "diagram", "proposal", "one-pager", "write like Tribe",
  "Tribe voice", "tribe.ai".
---

# Tribe Design

One skill, many crafts. Each sub-skill lives in its own folder with a
`SKILL.md` (read it before doing that kind of work), plus `tool/` (runnable
generator code), `assets/` (templates, fonts, logos), and `examples/`.

**Always start from `brand/SKILL.md`** for anything visual and
**`voice/SKILL.md`** for anything written. Then pull the sub-skill for the
artifact you're making.

## The brand in one paragraph

Editorial and calm, not "techy": warm paper `#FAFAF8` surfaces, near-black ink
`#06141B`, a light serif display (TribeSerif 300 — never bold) over a humanist
sans (TribeSans), uppercase caption labels (TribeCaption), and one cyan
signature `#65D9EE` used sparingly. Hierarchy via opacity, not new colors.
Accents (teal/brown/orange/yellow) only for numerals, single cards,
illustrations — never body copy, never large fills, and **never eyebrows —
eyebrows are ink**. Motion eased with `cubic-bezier(0.625,0.05,0,1)`, never
bouncy. Flat depth, hairline rules, warm neutrals — never pure white/black or
generic gray.

## Routing

| You need | Sub-skill | Output |
|---|---|---|
| Tokens, fonts, logos, brand rules | `brand/` | reference + assets |
| Copy in the Tribe voice (site, article, deck, doc) | `voice/` | guidance |
| Tusi orbital figure — hero art, backgrounds, motion | `animation/` | PNG (transparent) / WEBM |
| Social/quote/stat/announcement graphic | `social-card/` | PNG 1:1, 4:5, 9:16 |
| Chart / data graphic | `data-card/` | PNG 1:1, 16:9, 4:5 |
| Abstract generative cover / background art | `article-cover/` | PNG / SVG / WEBM reveal |
| Presentation, pitch, case study, proposal deck | `deck-builder/` | PDF (16:9 slides) |
| System diagram / flowchart | `diagram/` | SVG / PNG |
| Long-form document (proposal, one-pager, report) | `documents/` | HTML → PDF |
| Page or section on tribe.ai | `web-pages/` | code in the website repo |

## Exporting assets

`scripts/render.mjs` is the shared headless exporter (setup once:
`npm install` in `scripts/`):

```bash
node scripts/render.mjs --html <tool page> --query 'params=…' --out out.png   # still
node scripts/render.mjs --html <tool page> --webm out.webm --duration 4000    # motion
node scripts/render.mjs --html <file>|--url <url> --pdf out.pdf               # print
```

Each generator's `tool/NOTES.md` documents its parameters and exact commands.

PNG stills of canvas tools are captured straight from the canvas backing
store with high-quality resampling (never a screenshot of the CSS-scaled
element), so exports stay fully anti-aliased at any `--scale`. If an export
ever looks pixelated, pass `--selector canvas` so this path is used, and
check the tool's internal render scale (`RENDER_SCALE` / `?size`) is ≥ the
output size.

## Composing artifacts

The generators are ingredients — combine them:

- **Animation still → slide/card background.** Export a transparent PNG from
  `animation/`, place it behind generous paper in a deck slide or social card.
- **Article-cover art → deck cover, doc masthead, social base.** Generative
  art from `article-cover/` works anywhere a branded abstract visual is
  needed; the WEBM reveal makes an animated intro.
- **Data-card chart → slide or document figure.** Export the pure chart (omit
  title/logo params) and embed it.
- **Diagram SVG → slide, doc, or page.** SVG scales cleanly into any artifact.
- **Deck JSON → vector PDF, standalone.** `deck-builder/` authors slide JSON
  (you write it — no external LLM needed), encodes it to a hash, and renders
  it with the bundled `tool/deck.html` — browser preview + print, no website
  needed.

Keep the brand rules while composing: generated art is an **accent behind
generous paper, not a loud full-bleed fill**; one accent color per artifact;
ink eyebrows; light serif.

## Ground rules

1. Read the sub-skill's `SKILL.md` before producing that artifact type.
2. Visual artifact → apply `brand/`; written words → apply `voice/`.
3. Use the real fonts (`brand/assets/fonts/` + `brand/assets/tribe-tokens.css`)
   in any standalone artifact — fallback stacks are a last resort.
4. Compare your output against the sub-skill's `examples/` before delivering.
5. Verify exports by actually rendering them (render.mjs), not by assuming.
6. Never: bold serif, orange/accent eyebrows, pure white/black surfaces,
   gray shadows, more than one accent per artifact, stretched/recolored logos.
