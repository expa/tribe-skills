# Data Card tool — render notes

`data-card.html` is a standalone, param-driven harness that renders the Tribe
data card (bar/line chart) generator — a faithful vanilla-JS port of the
studio's `paint()` (original component preserved verbatim in
`reference/DataCardStudio.tsx`). It draws into a `<canvas>` at 2× the format's
native size (matching the studio's export), then sets `window.__READY__` (a
Promise that resolves after fonts + logo images load and the paint completes).
`scripts/render.mjs` awaits that signal before screenshotting.

## Rendering

From the skill root (`tribe-design/`):

```sh
node scripts/render.mjs \
  --html data-card/tool/data-card.html \
  --query "params=$(node -e 'console.log(encodeURIComponent(JSON.stringify({
    format: "16:9", chart: "bar", surface: "paper", accent: "teal",
    eyebrow: "By the numbers",
    title: "Time to production, by engagement",
    helper: "Source: Tribe delivery data",
    data: "Q1 12, 8\nQ2 19, 14\nQ3 27, 22\nQ4 41, 30"
  })))')" \
  --selector canvas \
  --out /tmp/data-bar.png \
  --width 1700 --height 1400 --scale 1
```

- Pass params as ONE URI-encoded JSON object in the `params` query key
  (the `node -e … encodeURIComponent(JSON.stringify(…))` trick is the
  reliable way to encode it, including the `\n` newlines in `data`).
- `--selector canvas` clips to the card. Canvas CSS size = native format dims,
  so use a viewport at least that big (`--width 1700 --height 1400` covers
  every format).
- Output PNG size = native dims × `--scale` (render.mjs default 2).
  render.mjs reads canvas pixels straight from the 2× backing store and
  downscales with high-quality resampling, so `--scale 1` is also fully
  anti-aliased.

## Parameters

All optional — omitted keys fall back to the studio defaults below.

| Param | Values | Default | Notes |
| --- | --- | --- | --- |
| `format` | `1:1` (1080×1080), `16:9` (1600×900), `4:5` (1080×1350) | `16:9` | Square / Landscape / Portrait |
| `chart` | `bar`, `line` | `bar` | Grouped bars vs multi-line |
| `surface` | `paper`, `sand`, `ink`, `ocean`, `teal`, `brand`, `brown`, `orange`, `yellow` | `paper` | Background. Ink (text) color derived by luminance — dark surfaces get light ink + inverted logo automatically |
| `accent` | `teal`, `orange`, `brown`, `yellow`, `ocean`, `brand` | `teal` | Color of the FIRST series. Additional series cycle through the remaining accents in order `teal → orange → brown → yellow → ocean → brand` (chosen accent moved to the front) |
| `logo` | `none`, `wordmark`, `symbol` | `wordmark` | Bottom-left watermark |
| `showValues` | `true`, `false` | `true` | Print each value above its bar / point |
| `eyebrow` | string | `By the numbers` | Uppercase TribeCaption kicker, **always ink-colored**. Empty string hides it |
| `title` | string | `Time to production, by engagement` | Serif-light title, word-wrapped. Empty hides it |
| `helper` | string | `Source: Analytics` | Small 50%-ink line, bottom-right on the logo row. Empty hides it |
| `data` | multiline string | `Q1, 12\nQ2, 19\nQ3, 27\nQ4, 41` | See format below — pass exactly what you'd type in the studio textarea (real `\n` newlines in the JSON string) |

## Data string format

One point per line: `Label, Value[, Value…]`

- **Label** may contain spaces. The first value can follow the label with a
  comma/tab OR just a space: `Q1, 12` and `Q1 12` both parse.
- **Multiple comma-separated values** on a line become grouped bars /
  multiple lines: `Q1 10, 20` → point Q1 with series values [10, 20].
  Series count = the max number of values on any line; missing values on a
  line simply skip that series at that point (line charts break the stroke).
- **Value tokens** may carry units/symbols — `42%`, `$3.2M`, `1.5×` — the
  number is extracted for the bar/point height, the token prints as typed.
- **Custom printed label**: append `(Anything)` to a value to override what's
  printed: `Q3 27 (Great)` plots 27 but prints "Great".
- Lines with no label or no parseable value are skipped. The y-scale runs
  from 0 to the max value (min 1).

Examples:

```
Q1, 12
Q2, 19
```

```
Jan 100, 80
Feb 72, 65
Mar 55 (55¢), 48
```

## What "correct" looks like

- Title: **TribeSerif Light (300)** — if you see Georgia/Times, fonts didn't
  load (the HTML must stay in `data-card/tool/` so `../../brand/assets/…`
  relative paths resolve).
- Eyebrow: TribeCaption, uppercase, letter-spaced, ink.
- Axis labels: uppercase TribeCaption at 60% ink; a single baseline hairline —
  no gridlines, no y-axis (values are labeled directly when `showValues`).
- Dark surfaces flip to paper-colored text + inverted wordmark automatically.

## Caveats

- Line charts span the plot edge-to-edge (first/last points sit on the
  margins), so the first/last value labels can hug the card edge — that
  matches the studio. Bar charts keep everything inside the margin.
- On dark/colored surfaces, later series colors (e.g. `ocean` on `ink`) can
  have low contrast against the background — pick surface/accent combos with
  the series count in mind. The palette cycles after 6 series.
- The chart auto-scales to max value only (no negative-value support —
  negatives draw below the baseline hairline).
- Unknown `format` / `chart` / `accent` values silently fall back to
  defaults; unknown `surface` falls back to `paper`.
- render.mjs default `--scale` is 2 → a 16:9 card outputs 3200×1800. Use
  `--scale 1` for exact 1600×900.
