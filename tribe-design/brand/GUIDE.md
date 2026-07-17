---
name: tribe-design-brand
description: Apply and review Tribe AI's official visual identity, including colors, typography, logos, spacing, surfaces, imagery, and composition. Use before creating or evaluating any Tribe-branded web UI, graphic, slide, document, diagram, email, or other visual artifact.
---

# Tribe Design — Brand

The visual identity every other tribe-design sub-skill builds on. Read this
before creating or reviewing ANY Tribe-branded artifact: web UI, social
graphics, slides, documents, diagrams, emails.

Tribe AI is an AI consulting and talent network. The brand reads **editorial and
calm, not "techy"**: warm paper-white surfaces, near-black ink, a light serif
display set against a humanist sans, and one cyan signature color used sparingly.
Confidence through restraint. Personality: precise, intelligent, human,
unhurried. Premium and trustworthy, with warmth from the paper palette and life
from the cyan figure.

> Normative token values: the `@theme` in `app/globals.css` of the website repo
> (authoritative for markup), mirrored in `lib/colors.tsx` (canvas/JS) and in
> `assets/tribe-tokens.css` here for standalone artifacts. A color change goes
> in all three.

## Color

The page is warm off-white, the ink is near-black — **never generic gray, pure
black, or pure white for surfaces.** Hierarchy on a surface comes from
**opacity**, not new colors: body `/70`, meta/labels `/45`–`/60`, hairlines
`/6`–`/15`.

| Role | Token | Hex |
|---|---|---|
| Page surface | `background-primary` | `#FAFAF8` |
| Soft surface | `background-soft` | `#F4F4F2` |
| Alt section / card | `background-secondary` | `#EBEBE2` |
| Dividers, muted UI | `background-tertiary` | `#C7BDB2` |
| Muted-darker | `background-quaternary` | `#A9A197` |
| Primary ink / dark surface | `foreground-primary` | `#06141B` |
| Darkest surface (pre-footer) | `foreground-secondary` | `#050F15` |
| **Brand cyan** (signature) | `brand` | `#65D9EE` |
| Text on a brand fill | `brand-contrast` | `#07404F` |
| Body text on dark footer | `brand-light` | `#C3D0D8` |
| Accent — teal | `accent-teal` / `-contrast` | `#0A99C3` / `#B2F3FF` |
| Accent — brown | `accent-brown` / `-contrast` | `#AD5913` / `#F4C29D` |
| Accent — orange | `accent-orange` / `-contrast` | `#FF7C0F` / `#6D1D00` |
| Accent — yellow | `accent-yellow` / `-contrast` | `#FEDE59` / `#7C6503` |
| Accent — ocean (deep) | `accent-ocean` / `-contrast` | `#0D4E6E` / `#BEE6F5` |

- **Surfaces** default to `background-primary`; alternate sections with
  `background-secondary`. "Dark" sections invert to `foreground-primary` (or
  `foreground-secondary` pre-footer) with `background-primary` text.
- **Brand cyan** is the signature: the Tusi figure, links, focus rings, list
  numerals, small highlights — **never a large fill of body text.** Put
  `brand-contrast` on text/graphics sitting on a brand fill.
- **Accents** are reserved for numerals, single cards, illustrations and small
  highlights — never body copy, never large background fills, and **never the
  eyebrow color**. When several cards each take an accent, cycle
  **teal → brown → orange → yellow**.
- **Eyebrows are ink** (`foreground-primary`), full strength for a primary hero
  eyebrow, `/50` for quiet secondary captions. This matches every live page.

## Typography

Three families (real files ship in `assets/fonts/`, wired via `@font-face` in
`assets/tribe-tokens.css`):

- **TribeSerif** — headlines, large display, pull quotes. **Almost always
  light (300). Never bold — a bold face doesn't even exist.**
- **TribeSans** — body, UI, descriptions. Body copy is typically light (300).
  Regular/Medium/DemiBold exist for UI emphasis.
- **TribeCaption** — eyebrows, labels, meta, buttons. **Always `uppercase` with
  positive letter-spacing.**

Canonical roles (ready-made classes in `assets/tribe-tokens.css`):

| Role | Family | Size / spec |
|---|---|---|
| Eyebrow / kicker | Caption | 12px, uppercase, `tracking 1.6px`, **ink** |
| H1 / hero | Serif light | `clamp(2.25rem, 5vw, 3.75rem)`, `leading 1.1`, balanced |
| H2 / section | Serif light | ~3rem, `leading 1.1`, balanced |
| H3 / card title | Serif light | 1.5rem |
| Body | Sans light | 1rem, `leading 1.625`, at `/70` |
| Lead body | Sans light | 1.125rem |
| Prose (long-form) | Sans light | 18px desktop / 16px mobile, `leading 1.75` |
| Meta (author · date) | Sans 400 | 12px at `/45`–`/60`, items split by `·` |
| Button label | Caption | 12px, uppercase, `tracking 1.2px` |

Use balanced wrapping on headings and pretty wrapping on multi-line body.

## Logo

Asset files ship in `assets/logos/` (mirrors `public/brand/` in the website
repo), each as SVG + PNG:

- **logo** — full lockup (symbol + wordmark): `logo`, `logo-inverted`, `logo-mono`
- **symbol** — mark only: `symbol`, `symbol-inverted`, `symbol-faded`
- **wordmark** — text only: `wordmark`, `wordmark-inverted`, `wordmark-mono`,
  `wordmark-mono-inverted`

Pick `-inverted` (or `-mono-inverted`) on dark surfaces, the full-color set on
light. The **Tusi figure** — an animated orbital line-and-dot figure — is the
brand's living motif; generate it with the `animation` sub-skill rather than
inventing unrelated decorative animation. Never recolor, stretch, or add
effects to the logo. Don't repurpose the logo as a generic link target.

## Motion

Motion is a brand signature — **purposeful, eased, never bouncy.** House easing
is `cubic-bezier(0.625, 0.05, 0, 1)`, durations ~0.3–0.65s. Text reveals use a
per-character stagger with an optional brief brand-cyan color flash before
settling to the inherited ink. Always degrade gracefully under
`prefers-reduced-motion` (plain fade, no transform).

## Depth & shape

Depth is mostly **flat** — hierarchy from surface color and opacity, not stacked
shadows. **Generic gray box-shadows are forbidden.** Floating elements use a
soft, ink-tinted shadow (`0 30px 80px -30px rgba(6,20,27,0.35)`). Hairline rules
(`divider`, or ink at `/6`–`/15`) separate stacked content. Corner radii:
`lg (0.5rem)` cards, `xl`/`2xl` feature panels & media, `md` chips/buttons,
`full` pills & dots. Imagery crops to fixed ratios (cards `4/3`, feature/hero
`16/10` or `16/7`).

## Do's & Don'ts

**Do** — warm neutrals for surfaces, opacity for on-surface hierarchy; keep the
serif light; ink eyebrows; reserve accents for numerals/single cards/
illustrations; reuse the Tusi figure and the house easing; keep tokens in sync
across the three token files.

**Don't** — ❌ generic grays / pure black / pure white surfaces · ❌ bold serif
headings · ❌ orange (or any accent) eyebrows · ❌ accent colors as body text or
large fills · ❌ heavy or gray drop shadows · ❌ abrupt or bouncy motion ·
❌ recoloring or distorting the logo.

## Files

- `assets/tribe-tokens.css` — copy-paste `:root` tokens + type-role classes +
  real `@font-face` wiring for any standalone HTML artifact.
- `assets/fonts/` — the real TribeSerif / TribeSans / TribeCaption files.
- `assets/logos/` — every logo/symbol/wordmark variant, SVG + PNG.
