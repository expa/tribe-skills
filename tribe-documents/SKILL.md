---
name: tribe-documents
description: >-
  Produce on-brand long-form documents for Tribe AI as self-contained HTML —
  one-pagers, proposals, reports, briefs, case-study write-ups — with the warm
  paper / ink palette, a serif-light masthead, a comfortable reading column,
  brand-numeral ordered lists, callout panels, and clean print/PDF output. Use
  when asked for a document, proposal, one-pager, report, brief, or
  memo in the Tribe look. Triggers on "write a proposal", "one-pager", "report",
  "brief", "document", "memo", "leave-behind".
---

# Tribe AI — Documents

On-brand long-form documents. **Read `tribe-brand` first.** Output is a
self-contained HTML file that reads beautifully on screen and prints to a clean
PDF (A4/Letter, proper margins, no nav chrome).

## Structure

- **Masthead** — small uppercase caption eyebrow (doc type / client), a
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

## Tone

The brand voice is precise, intelligent, human, unhurried. Lead with the
outcome. Short sentences. No hype, no jargon padding. Numbers and specifics over
adjectives.

## Template

`assets/document.html` is a working one-pager / proposal shell — masthead,
sections, a numbered list, a callout panel, a table, and print styles. Replace
the content, keep the structure. It inlines the brand tokens and uses fallback
fonts; add `@font-face` for the real fonts (see `tribe-brand`) for exact type.

## Don'ts

❌ Full-width body text (use the reading column) · ❌ bold serif headings ·
❌ accent colors as body text · ❌ gray boxes / heavy table borders / zebra
striping · ❌ pure white page or pure black text · ❌ disc bullets and default
numbered lists where the brand numerals belong.
