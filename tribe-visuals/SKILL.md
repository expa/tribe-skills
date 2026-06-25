---
name: tribe-visuals
description: >-
  Produce on-brand marketing and social graphics for Tribe AI — LinkedIn / X
  banners and avatars, Open Graph / link-preview cards, quote cards,
  announcement images — as self-contained HTML/SVG at the correct pixel
  dimensions, ready to screenshot/export. Applies the Tribe palette, the light
  serif + caption type system, and the node-graph / Tusi-orbital motif. Use when
  asked for a social post image, an OG image, a banner, a quote card, or any
  shareable branded visual. Triggers on "social graphic", "LinkedIn banner",
  "OG image", "quote card", "announcement image", "Twitter/X header".
---

# Tribe AI — Visuals

On-brand graphics for marketing and social. **Read `tribe-brand` first** — this
skill applies that system at fixed export dimensions. Output is a
**self-contained HTML file** (inline CSS, inline/data-URI assets) sized exactly
to the target so it can be screenshotted or rendered to PNG at 1×/2×.

## In-house generators (use these for figure art & backgrounds)

The Tribe site ships interactive generators at **`https://tribe.ai/handbook/…`**.
Three of them produce reusable **figure art and backgrounds** you can drop into a
visual, a slide, or a card — prefer them over hand-drawing the motif, and match
their look when you do hand-roll:

- **Animation** — `https://tribe.ai/handbook/animation` — the Tusi orbital
  figure. Tune rails, dots, draw and motion. Exports a **still (PNG/WEBP)** for a
  static background or accent, or **motion (WEBM)** for a moving slide/section
  background. Procedural — no upload needed. *Use as the hero motif, a section
  background, or a quiet accent — static or animated.*
- **Article Cover** — `https://tribe.ai/handbook/article-cover` — generative
  node-graph cover art (palette + layout). Exports **PNG / WEBP / SVG**.
  Procedural. *Use to illustrate a slide or card, or to add impact to a header.*
- **Case Study Cover** — `https://tribe.ai/handbook/case-study-cover` —
  pattern-driven covers (palette, density, flow, ratio 1:1 / 16:9 / 3:2), with an
  **optional** source-photo mix. Deterministic from the title. Exports
  **PNG / WEBP**. *Use as a cover, a slide background, or a card image.*

How to use the output: drop the exported file into a slide/card/`<img>`, or set
it as a `background-image` (use a still for a static background, the WEBM for a
moving one). Keep the brand rules from `tribe-brand` — the figure is an accent,
not a loud full-bleed fill; let the paper breathe.

> **Admin-only.** `Profile Picture`, `Email Signature` and `Social Asset Preview`
> are internal-only tools (some call external services / private data) and are
> locked for outsiders — don't route public/agent work through them.

> **Generating these programmatically (maintainer note).** Today all three are
> **interactive, browser-only** tools: a person opens the page, configures it, and
> clicks Download. There is **no URL-parameter or HTTP API** that returns an
> image, so an AI agent cannot fetch one directly — it must be handed an exported
> file, or drive the page in a headless browser. To make them agent-callable,
> wire each page's config to `searchParams` (+ an `?auto=1` render-and-signal
> mode) and add a token-gated render route (puppeteer-core + @sparticuz/chromium,
> needed because the animation is WebGL). Until that exists, treat generator
> output as a human-supplied asset.

## Canonical dimensions

| Asset | Pixels | Notes |
|---|---|---|
| Open Graph / link preview | 1200 × 630 | site cards, blog shares |
| LinkedIn company banner | 1128 × 191 | keep text clear of the avatar overlap (bottom-left) |
| LinkedIn personal banner | 1584 × 396 | |
| X / Twitter header | 1500 × 500 | |
| Square post | 1080 × 1080 | quote cards, announcements |
| Portrait post | 1080 × 1350 | |
| Avatar | 400 × 400 | symbol on a single fill, generous padding |
| Email signature | 600 × 200 | matches the generator |

## Visual recipe

1. **Surface** — warm paper `#FAFAF8`, or invert to ink `#06141B` for a "dark"
   piece. Never pure white/black/gray.
2. **One accent, maximum.** Pick a single accent (teal → brown → orange → yellow)
   per asset for an eyebrow, a numeral, or a single shape. The brand cyan
   `#65D9EE` is for the figure/marks, not large fills.
3. **Type** — serif-light headline (balanced wrap), uppercase caption eyebrow in
   orange, sans-light supporting line at `/70`. Keep the headline short; let the
   paper breathe.
4. **Motif** — anchor with the node-graph / Tusi orbital figure (dots + thin
   rails in brand cyan on ink, or ink on paper). Subtle, off to one side or
   bleeding off an edge — not centered clip-art.
5. **Logo** — wordmark/symbol from `/public` (mono-inverted on dark). Small,
   in a corner, never recolored or distorted.
6. **Depth** — flat. Hairlines and opacity, not gray shadows.

## Template

`assets/social-card.html` is a ready, self-contained 1200×630 OG card — edit the
text/accent, screenshot the `.frame`, done. Duplicate and change the `.frame`
width/height for other dimensions. It embeds the brand tokens inline and uses
the fallback font stacks; for pixel-exact type, add `@font-face` rules pointing
at copies of the real fonts from `/public/fonts` (see `tribe-brand`'s
`assets/tribe-tokens.css`).

## Don'ts

❌ Stock/AI-gradient backgrounds · ❌ pure white or pure black surfaces ·
❌ more than one accent per asset · ❌ bold serif · ❌ drop shadows on text ·
❌ the logo stretched, tinted, or floating mid-canvas · ❌ centered, symmetric
"tech" clip-art instead of the node/orbital motif.
