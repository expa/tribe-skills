---
name: tribe-slides
description: >-
  Create on-brand presentation decks for Tribe AI as self-contained HTML — 16:9
  slides with the warm paper / ink palette, light serif titles, uppercase
  caption labels, one-accent-per-slide restraint, and the node/orbital motif.
  Keyboard-navigable, print/PDF-ready. Use when asked for a deck, pitch,
  presentation, or slides to express an idea in the Tribe look. Triggers on
  "make a deck", "slides", "presentation", "pitch deck", "present this".
---

# Tribe AI — Slides

On-brand decks. **Read `tribe-brand` first.** Output is one self-contained HTML
file: 16:9 slides, arrow-key/space navigation, and clean page breaks so it
prints to PDF (one slide per page).

## Principles

- **One idea per slide.** Lots of paper, little text. The headline is a
  serif-light line; supporting copy is sans-light at `/70`.
- **Eyebrow → title → content.** Every slide opens with an uppercase caption
  eyebrow (slide section/label), then a serif-light title.
- **Alternate surfaces** across the deck: paper `#FAFAF8` slides with occasional
  inverted ink `#06141B` slides for emphasis (section dividers, the closing
  slide). Don't put two dark slides back to back.
- **One accent per slide**, cycling teal → brown → orange → yellow across the
  deck — for the eyebrow, a numeral, or a single highlighted figure. Brand cyan
  is for the motif/marks and key numbers, never large fills.
- **Numbers are the hero.** Big stat? Serif-light, large, with a small caption
  label beneath. Let it stand alone.
- **Motif, not clip-art.** Anchor a divider or the title slide with the
  node/orbital figure bleeding off an edge. No stock icons, no gradients.
- **Restrained motion** — a quiet fade between slides is plenty; respect
  `prefers-reduced-motion`. No flashy transitions.

## Slide patterns

- **Title** — eyebrow + big serif title + presenter/date meta; orbital motif off
  one edge.
- **Section divider** — inverted ink slide, large numeral in an accent, section
  title in serif-light.
- **Content** — eyebrow + title + a short body, a 2–3 item list, or a small
  bento of light cards (`background-secondary`, `rounded-lg`).
- **Stat** — one large serif number (optionally brand cyan) + caption label.
- **Quote** — serif-light pull quote, attribution in caption meta.
- **Close** — inverted slide, wordmark, one CTA line, contact in caption.

## Template

`assets/deck.html` is a working multi-slide deck — title, section divider,
content, stat, and close slides — with keyboard nav and print styles. Duplicate
a `<section class="slide">`, change the copy and the `data-accent`, and you have
a new slide. It inlines the brand tokens and uses fallback fonts; add `@font-face`
for the real fonts (see `tribe-brand`) for pixel-exact type.

## Don'ts

❌ Dense slides / paragraphs · ❌ bold serif · ❌ more than one accent per slide ·
❌ gray shadows or boxed "PowerPoint" cards · ❌ stock icons & gradient fills ·
❌ bouncy or sliding transitions.
