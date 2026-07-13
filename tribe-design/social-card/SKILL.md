---
name: tribe-design-social-card
description: Generate on-brand Tribe social graphics with custom text, official layouts, surfaces, accents, and typography. Use for quote cards, announcements, statement cards, statistic cards, partner lockups, OG images, LinkedIn graphics, and other social assets.
---

# Tribe Design — Social Card

On-brand social graphics with custom text — quote cards, statement/announcement
cards, stat cards, partner lockups — exported as static images. **Read
`../brand/SKILL.md` first.**

## The generator (preferred path)

`tool/social-card.html` is a runnable port of the website's social-card studio.
Author a params JSON, render headlessly:

```sh
node ../scripts/render.mjs \
  --html tool/social-card.html \
  --query "params=$(node -e 'console.log(encodeURIComponent(JSON.stringify({
    mode: "quote", format: "1:1", surface: "ink", accent: "brand",
    eyebrow: "Client stories",
    quote: "AI adoption is a people problem before it is a technology problem.",
    author: "Jane Doe", role: "CTO, Acme"
  })))')" \
  --selector canvas --out out.png --width 1200 --height 2000 --scale 1
```

**`tool/NOTES.md` is the full parameter reference** — modes
(`quote|statement|stat|partner`), formats (`1:1` 1080², `4:5` 1080×1350,
`9:16` 1080×1920), 9 surfaces, 6 accents, per-mode text fields, defaults, and
caveats. Read it before rendering.

Layout, fonts, wrapping, auto-shrink, surface-aware ink/logo inversion are all
handled by the tool — your job is choosing mode/surface/accent and writing the
copy (see `../voice/SKILL.md`; keep quotes ≤ ~200 chars, headlines ≤ ~90).

## Choosing well

- **Surface**: `paper` default; `ink` for gravitas (quotes, big stats); one of
  the color surfaces only when the set needs variety. Dark surfaces
  auto-invert text and logo.
- **One accent per card**, cycling teal → brown → orange → yellow across a
  series. Accent colors the quote marks / hero stat only — eyebrows stay ink.
- **Copy is the design.** Short headline, let the surface breathe. Website
  voice register: sentence case, terminal period, contrast pivots.

## Custom compositions (fallback path)

For sizes/layouts the generator doesn't cover (OG images, LinkedIn banners,
X headers), write a self-contained HTML file and screenshot it:
`assets/og-template.html` is a working 1200×630 OG card wired to the real
brand fonts — duplicate the `.frame`, change dims and copy.

| Asset | Pixels |
|---|---|
| Open Graph / link preview | 1200 × 630 |
| LinkedIn company banner | 1128 × 191 |
| LinkedIn personal banner | 1584 × 396 |
| X / Twitter header | 1500 × 500 |
| Square / portrait post | 1080 × 1080 / 1080 × 1350 |
| Story | 1080 × 1920 |
| Avatar | 400 × 400 (symbol on a single fill, generous padding) |

Background/figure art: export from `../animation` (Tusi still) or
`../article-cover` (generative art) and place it behind generous paper —
subtle, off to one side or bleeding off an edge, never centered clip-art.
Never fully behind the text: a slight overlap at the edges is fine, but
resize or reposition the art so copy sits on clear surface.

## Examples

`examples/` holds verified renders — compare before delivering:
`social-quote.png` (ink + brand accent), `social-stat.png` (paper + orange),
`social-statement.png` (4:5 sand), `social-partner.png` (partner lockup).

## Don'ts

❌ Stock/AI-gradient backgrounds · ❌ pure white or pure black surfaces ·
❌ more than one accent per asset · ❌ orange/accent eyebrows · ❌ bold serif ·
❌ drop shadows on text · ❌ the logo stretched, tinted, or floating mid-canvas.
