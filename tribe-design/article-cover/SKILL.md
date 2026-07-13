# Tribe Design — Article Cover (node generator)

Abstract generative artwork in the Tribe style — node/dot/trace fields drawn
from a seeded pipeline, optionally sampling a source photo. Use for article
covers, deck cover art, document mastheads, section backgrounds, or any
branded abstract visual. Exports stills (PNG) and an animated "wash" reveal
(WEBM) for transitions.

## The generator

`tool/node-cover.html` is a vanilla-JS port of the website's node-generator
render pipeline.

```sh
# Still from a built-in preset
node ../scripts/render.mjs --html tool/node-cover.html \
  --query 'preset=<name>&size=1600' \
  --selector canvas --out cover.png --width 1600 --height 1100 --scale 1

# Animated reveal (for video use)
node ../scripts/render.mjs --html tool/node-cover.html \
  --query 'preset=<name>&animate=1&size=1200' \
  --webm cover.webm --duration 3500 --width 1200 --height 800
```

- `?preset=<name>` — built-in compositions (list in `tool/NOTES.md`).
- `?theme=<name>` — palette theme override.
- `?settings=<URI-encoded JSON>` — partial override of node settings
  (density, routing `strict|free|traces|flow|directional`, dot/line scale,
  thresholds, nuances, …).
- `?image=<path|URL>` — sample a source photo into the field
  (`tool/samples/` has a few; the full set lives in the website repo under
  `public/node-generator/samples/`).
- `?ratio=1:1|3:2|2:3|16:9|9:16`, `?seed=<n>`, `?size=<longest edge>`.

**`tool/NOTES.md` is the full reference** — presets, themes, settings schema,
caveats. Read it before rendering. Originals in `tool/reference/`.

## Choosing well

- **Deterministic from the seed** — same params + seed = same art. Iterate
  the seed until the composition sits well; record the winning params.
- Prefer a **built-in preset + seed change** over hand-tuning settings; the
  presets encode compositions the team already likes.
- Keep it an **accent**: covers and backgrounds should let paper breathe —
  choose presets/settings with open space rather than dense full-field
  texture when the art sits behind text.
- **Don't run text over the art.** Text sits on clear paper; the art can
  graze the text block's edges, but if it lands fully behind the copy, resize
  or reposition it (smaller, offset, bleeding off an edge) until it clears.
- The animated reveal is an intro transition, not a loop — use it to bring a
  cover in, then rest on the still.

## Examples

`examples/` holds verified renders — compare before delivering.

## Don'ts

❌ Off-palette colors (themes only) · ❌ dense texture behind body text ·
❌ art fully behind text (edge overlap ok — resize to avoid collisions) ·
❌ stretching the art (re-render at the right ratio instead) · ❌ using it
where the Tusi figure is the right motif (see `../animation`).
