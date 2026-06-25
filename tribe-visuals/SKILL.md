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

## In-house generators (prefer these when they fit)

The website already ships interactive generators under `/handbook`. Reach for
them before hand-rolling, and match their look when you do hand-roll:

- **Article Cover** (`/handbook/article-cover`) — generative node-graph cover
  art from a source photo, palette and layout.
- **Case Study Cover** (`/handbook/case-study-cover`) — pattern-driven covers
  (palettes, density, flow, optional photo mix).
- **Profile Picture** (`/handbook/profile-picture`) — restyle a headshot into an
  on-brand portrait.
- **Email Signature** (`/handbook/email-signature`) — 600×200 signature with the
  Tusi orbital figure.
- **Social Asset Preview** (`/handbook/social-preview`) — mock avatars/banners
  on real LinkedIn & X profiles before exporting.
- **Animation** (`/handbook/animation`) — tune & export the Tusi orbital figure.

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
