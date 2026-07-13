# Social Card tool — render notes

`social-card.html` is a standalone, param-driven harness that renders the Tribe
social card generator (a faithful vanilla-JS port of the studio's `paint()` —
original component preserved verbatim in `reference/SocialCardStudio.tsx`).
It draws into a `<canvas>` at 3× the format's native size (matching the
studio's export), then sets `window.__READY__` (a Promise that resolves after
fonts + logo images load and the paint completes). `scripts/render.mjs` awaits
that signal before screenshotting.

## Rendering

From the skill root (`tribe-design/`):

```sh
node scripts/render.mjs \
  --html social-card/tool/social-card.html \
  --query "params=$(node -e 'console.log(encodeURIComponent(JSON.stringify({
    mode: "quote", format: "1:1", surface: "ink", accent: "brand",
    eyebrow: "Client stories",
    quote: "AI adoption is a people problem before it is a technology problem.",
    author: "Jane Doe", role: "CTO, Acme"
  })))')" \
  --selector canvas \
  --out /tmp/social-quote.png \
  --width 1200 --height 2000 --scale 1
```

- Pass params as ONE URI-encoded JSON object in the `params` query key.
  The `node -e … encodeURIComponent(JSON.stringify(…))` trick above is the
  reliable way to encode it from a shell.
- **Copy containing apostrophes or quotes** ("Tribe's…") breaks the inline
  single-quoted `node -e` trick. Write the params JSON to a file first, then
  encode from the file:
  `PARAMS=$(node -e 'console.log(encodeURIComponent(require("fs").readFileSync(process.argv[1],"utf8")))' params.json)`
- `--selector canvas` clips the shot to the card. The canvas element's CSS
  size is the format's native dims (e.g. 1080×1080), so pick a viewport at
  least that big (`--width 1200 --height 2000` covers every format;
  element screenshots also work if the element overflows the viewport).
- Output PNG size = native dims × `--scale` (default 2 → 2160×2160 for a
  square). render.mjs reads canvas pixels straight from the 3× backing store
  and downscales with high-quality resampling, so both `--scale 1` (1080px)
  and `--scale 2` (retina) come out fully anti-aliased.

## Parameters

All optional — omitted keys fall back to the studio defaults below.

| Param | Values | Default | Notes |
| --- | --- | --- | --- |
| `format` | `1:1` (1080×1080), `4:5` (1080×1350), `9:16` (1080×1920) | `1:1` | Square / Portrait / Story |
| `mode` | `quote`, `statement`, `stat`, `partner` | `quote` | Which layout to compose |
| `surface` | `paper`, `sand`, `ink`, `ocean`, `teal`, `brand`, `brown`, `orange`, `yellow` | `paper` | Background. Ink (text) color is derived by luminance — dark surfaces get light ink + inverted logo automatically |
| `accent` | `orange`, `teal`, `brown`, `yellow`, `ocean`, `brand` | `teal` | Used for the quote marks (quote mode) and the hero number (stat mode) only |
| `logo` | `wordmark`, `symbol`, `none` | `wordmark` | Bottom-left watermark |
| `eyebrow` | string | `Field notes` | Kicker above the content; rendered UPPERCASE in TribeCaption, **always ink-colored** (brand rule: never orange/accent). Empty string hides it |

### Mode: `quote`
| Param | Default | Notes |
| --- | --- | --- |
| `quote` | `The best AI strategy is the one your team can actually ship.` | No quotation marks needed — accent-colored hanging marks are drawn automatically |
| `author` | `Jane Doe` | Attribution |
| `role` | `Partner, Tribe AI` | Joined with author as `AUTHOR · ROLE` (uppercase, 60% ink) |

### Mode: `statement`
| Param | Default | Notes |
| --- | --- | --- |
| `headline` | `AI that ships, not slideware.` | Serif-light, auto-fit |
| `body` | `We embed senior practitioners to build production systems with your team.` | Optional supporting line (sans-light, 70% ink). Empty string hides it |

### Mode: `stat`
| Param | Default | Notes |
| --- | --- | --- |
| `statValue` | `3.2×` | Hero number, serif-light in the ACCENT color |
| `statLabel` | `faster time to production` | Serif line under the number |
| `support` | `Across 40+ enterprise engagements` | Optional caption (uppercase, 60% ink). Empty hides it |

### Mode: `partner`
| Param | Default | Notes |
| --- | --- | --- |
| `partnerLogoUrl` | `''` | Partner logo image: absolute `https:`/`file:` URL or `data:` URL. **Always tinted to the ink color** (its alpha shape is filled solid), so any logo file works on any surface. Empty → a dashed "PARTNER LOGO" placeholder box |
| `showSymbol` | `true` | Tribe symbol + `×` before the partner logo in the lockup |
| `partnerScale` | `1` | Partner logo height multiplier (studio range 0.5–1.2) |
| `headline` | (statement default) | The announcement line |
| `support` | (stat default) | Optional supporting line |

## What "correct" looks like

- Headlines/quotes/stat numbers: **TribeSerif Light (300)** — a warm
  old-style serif. If you see Georgia/Times, fonts didn't load (check the
  `../../brand/assets/fonts/` relative path — the HTML must stay in
  `social-card/tool/`).
- Eyebrow + captions: TribeCaption, uppercase, letter-spaced, ink-colored.
- Dark surfaces (`ink`, `ocean`, `teal`, `brown`) automatically flip to
  paper-colored text and the inverted wordmark/symbol.
- Long text auto-shrinks (down to a floor) and word-wraps inside the 10%
  safe margin — it never overflows the card.

## Caveats

- The harness must be opened from its location in `social-card/tool/` —
  fonts and logos are referenced relatively (`../../brand/assets/…`).
- `partnerLogoUrl` over `https:` is loaded without CORS (screenshots don't
  need an untainted canvas); if a remote logo fails to load, the placeholder
  box renders instead — prefer a local `file:` or `data:` URL.
- Quote/statement main text has a minimum font size; absurdly long copy will
  eventually overflow the bottom rather than shrink forever. Keep quotes to
  ~200 chars, headlines to ~90.
- Values not in the allowed lists for `format` / `mode` / `accent` silently
  fall back to defaults; an unknown `surface` falls back to `paper`.
- render.mjs default `--scale` is 2 → a 1:1 card outputs 2160×2160. Use
  `--scale 1` for exact 1080×1080.
