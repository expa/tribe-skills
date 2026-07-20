---
name: tribe-design-documents
description: Create Tribe-branded one-pagers, proposals, briefs, and reports by authoring document data (JSON blocks) for the website's doc generator. Exports true A4 PDFs via the generator API, and the same data file imports into the on-site editor for manual editing.
---

# Tribe Design — Documents

On-brand long-form documents — one-pagers, proposals, reports, briefs,
case-study write-ups. The website's **doc generator**
(`website/app/handbook/doc-generator`, live at `/handbook/doc-generator`)
owns ALL visual rules — typography, spacing, tokens, the A4 sheet chrome.
Your job is only to structure the content as **document data**: a JSON file
of ordered blocks. Never hand-style a document when the block vocabulary
covers it.

**Read `../brand/GUIDE.md` first**, and `../voice/GUIDE.md` for the writing.

## Workflow

1. **Author `<name>.json`** — shape `{ "config": {…}, "blocks": […] }`.
   Read **`assets/blocks-guide.md`** (config + all 12 block types, every
   field, when to use each) and start from `assets/example-doc.json` — a
   complete real one-pager.
2. **Export the PDF** through the running website (local `npm run dev` in
   `website/`, or the deployed site):

   ```bash
   curl -sS -X POST http://localhost:3000/handbook/doc-generator/api/export-pdf \
     -H 'Content-Type: application/json' --data-binary @my-doc.json -o my-doc.pdf
   ```

   Default is one continuous artboard page; add top-level
   `"paginate": true` to the JSON for real A4 pages with print margins
   (use for anything longer than ~1 sheet).
3. **Deliver BOTH files, always** — the PDF and the `.json` next to it. The
   JSON is the editable source: anyone opens `/handbook/doc-generator`,
   clicks **Import data**, edits every block in place (text, order, widths,
   accents, per-block AI), and re-exports. **Export data** in the editor
   produces the same file back, so a human-edited document can return to you
   for revision.

## Document craft

- **Structure**: open with one `header` block (the masthead), then alternate
  `section` headers with their content. Use `statement` as a breather
  between dense sections.
- **Titles are assertions, not labels** — "Using AI is not the same as being
  AI-native", never "Introduction".
- **One idea per block.** Keep body copy tight — a one-pager, not an essay.
- **Proof beats claims**: real metrics in `stats`, real stories in `cards`,
  real quotations in `quote`. **Never invent facts, clients, metrics, or
  quotes** — omit any field you don't have real content for (empty fields
  render nothing).
- **Rhythm**: never two dense item-grid blocks (`numbered`/`cards`/`stats`)
  back to back — separate with `text`, `statement`, or a `divider`.
- **Width**: blocks are `"full"` by default; two consecutive `"half"` blocks
  sit side by side — use for paired content. Item-grid blocks already have
  columns and should almost always stay full.
- **Accents**: `teal | brown | orange | yellow | ocean` tint numerals and
  labels. One accent per section, varied sensibly across the document;
  default teal.
- **Plain text only** in every field — no HTML, no markdown. Paragraph break
  in `body` is a literal `\n\n`.
- **Images**: hosted URLs (the CMS media library serves client/partner logos
  from Blob storage). A `layout: "row"` images block with `tint: "ink"` is
  the client-logo-bar treatment. For cover/section art, export from
  `../article-cover` or `../animation` — don't hand-draw a motif.

## Voice

Write in the Tribe voice — see `../voice/GUIDE.md`. Editorial and calm, not
"techy". Lead with the outcome. Short declarative headlines. Plain, concise
body copy — no hype, no exclamation marks, numbers and specifics over
adjectives.

## Fallback: standalone HTML

`assets/document.html` is a self-contained print-ready HTML shell (masthead,
reading column, brand numerals, panel, table) for when no website is
available or the document genuinely needs layout beyond the block
vocabulary. Export: `node ../scripts/render.mjs --html <file> --pdf out.pdf`.
Prefer the generator path — it's editable by non-technical people.

## Don'ts

❌ Hand-styled HTML when blocks cover it · ❌ invented metrics, clients, or
quotes · ❌ markdown/HTML inside block fields · ❌ two item-grids back to
back · ❌ "Introduction"-style label titles · ❌ half-width item-grid blocks
· ❌ shipping a PDF without its `.json` source.
