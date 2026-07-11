# Tribe Design — Documents

On-brand long-form documents — one-pagers, proposals, reports, briefs,
case-study write-ups — as self-contained HTML. **Read `../brand/SKILL.md`
first**, and `../voice/SKILL.md` for the writing itself. Output is a
self-contained HTML file that reads beautifully on screen and prints to a clean
PDF (A4/Letter, proper margins, no nav chrome).

## Structure

- **Masthead** — small uppercase caption eyebrow (doc type / client) in ink, a
  serif-light title, and a meta line (date · author · confidentiality) at `/55`.
  A hairline rule under it.
- **Reading column** — a single centered column, max ~720px, sans-light body at
  18px (16px print), `line-height 1.75`. Generous space above headings.
- **Headings** — section headings serif-light (`h2`), sub-headings a heavier
  sans (`h3`). Leave air above them.
- **Lists** — ordered lists use zero-padded brand-cyan numerals (`01`, `02`, no
  dot), smaller than the text, hanging indent. Unordered lists are borderless
  with a thin left rule per item (no disc).
- **Panel / callout** — `background-secondary`, `rounded-lg`, hairline border,
  an uppercase caption label, 16px content. For key takeaways, scope notes,
  pull-outs.
- **Inline links** — brand cyan, underlined, 4px offset.
- **Tables** — hairline rules only, caption-style uppercase headers, generous
  row padding. No zebra fills, no heavy borders.
- **Footer** — wordmark + page meta; repeats on print pages.
- **Cover / section art** — for a document that needs visual impact (proposal
  cover, section break), export art from the `../article-cover` or
  `../animation` sub-skills and embed it — don't hand-draw a motif.

## Tone

Write in the Tribe voice — see `../voice/SKILL.md`. Lead with the outcome.
Short sentences. No hype, no jargon padding. Numbers and specifics over
adjectives.

## Template

`assets/document.html` is a working one-pager / proposal shell — masthead,
sections, a numbered list, a callout panel, a table, and print styles. Replace
the content, keep the structure. It inlines the brand tokens with fallback
fonts; for pixel-exact type, add the `@font-face` block from
`../brand/assets/tribe-tokens.css` (fonts ship in `../brand/assets/fonts/`).

## Export

Print to PDF from a browser, or headless:
`node ../scripts/render.mjs --html <file> --pdf out.pdf`

## Don'ts

❌ Full-width body text (use the reading column) · ❌ bold serif headings ·
❌ orange/accent eyebrows (eyebrows are ink) · ❌ accent colors as body text ·
❌ gray boxes / heavy table borders / zebra striping · ❌ pure white page or
pure black text · ❌ disc bullets and default numbered lists where the brand
numerals belong.
