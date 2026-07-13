# Tribe Design — Deck Builder

Presentations, pitches, case studies, and proposals as 16:9 slide decks.
Author the deck as JSON (18 SlideForge layouts); the bundled standalone
renderer previews it in any browser and prints a **vector PDF** — no website
needed.

## Workflow

1. **Author** `deck.json` — `{ "deck": {…}, "slides": […] }`. Read
   `assets/layout-guide.md` (all 18 layouts, every field, when to use each)
   and start from `assets/example-deck.json` or
   `examples/layout-showcase.json`. Authoring rules — one idea per slide,
   text budgets, accent cycling, figure use — in `tool/NOTES.md`; copy rules
   in `../voice/SKILL.md`.
2. **Encode**: `node tool/encode-deck.mjs deck.json --hash-only` → the hash
   (also `--decode` to inspect an existing link).
3. **Preview**: open `tool/deck.html#<hash>` in a browser — arrow keys
   navigate, `P`/Cmd+P prints. Or send someone the file: with no hash it
   shows a drag-and-drop zone for a `deck.json`.
4. **Export PDF** (vector text, ~100KB):
   `node ../scripts/render.mjs --html tool/deck.html --query 'deck=<hash>' --pdf out.pdf --width 1280 --height 720`

Full schema quick-reference, per-figure caveats, and the site-connected
alternative (SlideForge share URLs on tribe.ai, raster export via
`tool/export-deck.mjs`) are in **`tool/NOTES.md`**.

## Slide principles

- **One idea per slide.** Lots of paper, little text. Serif-light headline
  (~8 words max, no trailing punctuation); supporting copy sans-light at `/70`.
- **Eyebrow → title → content.** Eyebrows are uppercase caption, **ink**
  (the frame renders them at `/45` automatically).
- **Alternate surfaces** — paper slides with occasional inverted ink slides
  for emphasis (chapters, close). Never two dark slides back-to-back.
- **One accent per slide**, cycling teal → brown → orange → yellow.
- **Numbers are the hero** — a big stat gets a slide (`stats`/`statement`).
- **Never invent facts** — use only what the user gave; omit fields you don't
  have content for (empty fields render nothing).
- **Cover art & backgrounds**: the `cover` layout carries the static Tusi
  vector figure; for extra art, export from `../animation` or
  `../article-cover` and reference hosted image URLs — accents behind
  generous paper, not loud full-bleed fills. Never sit the figure/art fully
  behind text — edge overlap is fine, but resize or offset the art so copy
  reads on clear surface.

## Fidelity notes

The standalone renderer is pixel-matched to the website's SlideForge for all
layouts and chrome. Known deltas (detailed in `tool/NOTES.md`): the cover
figure and `rose`/`honeycomb` figures render as static vectors (the site
animates them on screen); canvas-only figures (`orbit`, `sphere`, `symbol`,
`whatWeDo`, `partners`) render nothing — same as the site's own print path.
Side-by-side comparisons live in `examples/`.

## Don'ts

❌ Dense slides / paragraphs · ❌ bold serif · ❌ more than one accent per
slide · ❌ gray shadows or boxed "PowerPoint" cards · ❌ stock icons & gradient
fills · ❌ invented metrics, clients, or quotes.
