# Tribe Design — Animation (Tusi figure)

The Tusi orbital line-and-dot figure — the brand's living motif. Use it as
hero art, a section/slide background, or a quiet accent — static (transparent
PNG) or moving (WEBM). **This is the ONLY decorative animation the brand
allows** — never invent unrelated motion graphics.

## The generator

`tool/tusi.html` is a faithful vanilla-JS port of the website's Canvas2D
renderer. Deterministic stills (simulated to an exact frame time) and live
playback for video capture.

```sh
# Still — transparent PNG, home-hero look
node ../scripts/render.mjs --html tool/tusi.html \
  --query 'preset=home&size=1200' \
  --out tusi.png --width 1200 --height 1200 --transparent

# Motion — 4s WEBM of the orbit figure
node ../scripts/render.mjs --html tool/tusi.html \
  --query 'preset=orbit&play=1&size=1000' \
  --webm tusi.webm --duration 4000 --width 1000 --height 1000
```

- **Presets** (`?preset=`): `home` (hero wireframe sphere + glow dots),
  `what-we-do`, `model` (crown + 40 rails + colored dots), `partners`,
  `orbit` (tumbling ring ball with palette dots). Defined as data in
  `tool/presets.json`.
- **Custom**: `?params=<URI-encoded JSON>` merged over defaults — accepts the
  studio settings (numRails, circleSize, speed, dotSize, trailSize, draw,
  tilt, rotation, …) and raw component props for exact control.
- `?background=` (css color; default transparent except multiply/hero
  presets), `?size=` (backing-store longest edge, default 2000), `?t=<s>`
  (frame time for stills), `?play=0|1`.

**`tool/NOTES.md` is the full parameter reference** — read it before custom
renders. `tool/reference/` holds the original site sources.

## Using the output

- Drop the transparent PNG behind content in a slide, card, or document — off
  to one side or bleeding off an edge, an accent behind generous paper, never
  a loud centered fill.
- **Never sit the figure fully behind text.** Text belongs on clear paper; a
  slight overlap where the figure's edge grazes the text block is fine, but if
  they collide, resize or reposition the figure (smaller, further off-edge)
  rather than letting copy run over the lines and dots.
- The WEBM works as a moving slide/section background — keep it quiet.
- Wide compositions (home/model presets, `circleSize` ≥ 60) intentionally
  bleed past a square viewport — render at e.g. 1600×1000 to frame the
  colored dots.

## Examples

`examples/` — verified renders: `tusi-home.png`, `tusi-model.png`,
`tusi-orbit.png`, `tusi-orbit.webm`. Compare before delivering.

## Don'ts

❌ Recoloring the figure outside the brand palette · ❌ using it as dense
full-bleed texture · ❌ the figure fully behind text (edge grazing ok — resize
to avoid collisions) · ❌ mixing it with other decorative animation · ❌ bouncy
or sped-up motion (the figure is slow and unhurried).
