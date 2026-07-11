# Tusi animation tool — maintainer notes

`tusi.html` is a standalone, param-driven harness for the Tribe "Tusi" orbital
animation. It is a faithful vanilla-JS port of the Canvas2D draw loop in
`reference/TusiAnimation.tsx` plus the preset/prop-derivation logic of
`reference/AnimationStudio.tsx`. No server, no React, no external assets —
render it headlessly with `scripts/render.mjs` (from the skill root).

## URL parameters

| Param | Values | Default | Notes |
|---|---|---|---|
| `preset` | `home` \| `what-we-do` \| `model` \| `partners` \| `orbit` | — | Studio section presets (see `presets.json`) |
| `params` | URI-encoded JSON | `{}` | Merged over DEFAULTS (and the preset). Accepts studio settings AND raw component props |
| `background` | CSS color \| `transparent` | preset-driven | Canvas paint. Presets with `multiplyDots`/`heroOverlay` default to `#FAFAF8` (the blends need a light backdrop); everything else defaults to transparent |
| `size` | px | `2000` | Canvas backing-store longest edge (internal resolution; used by `__EXPORT_PNG__`) |
| `dpr` | number | — | Explicit backing-store pixel ratio; overrides `size` |
| `play` | `0` \| `1` | `0` | `0` = static frame (stills), `1` = live animation (video) |
| `t` | seconds | `4` (still) / `0` (play) | Still: frame time to render (simulated at a deterministic 60fps, so trails/eases are populated). Play: pre-roll simulated before live playback |

## Settings keys (studio-level, usable in `?params`)

Ranges are the studio slider ranges.

| Key | Range/type | Default | Meaning |
|---|---|---|---|
| `numRails` | 1–24 | 6 | Number of rails/dots (also ring count in orbit mode) |
| `circleSize` | 10–90 | 50 | Figure radius as % of min(W,H). NOTE: >50 bleeds off a square viewport |
| `speed` | 1–100 | 10 | Orbital speed (omega = speed/50 rad/s) |
| `dotSize` | 0–80 | 10 | Dot diameter px (in CSS-pixel space) |
| `trailSize` | 0–60 | 0 | Trail length in frames |
| `draw` | 0–100 | 100 | How much of each circle/line is drawn (0 hides swept outlines/rails) |
| `xOffset` | -500–500 | 0 | Horizontal shift of figure centre (clamped on-screen) |
| `tilt` | -90–90 | 0 | X-axis perspective tilt (degrees) |
| `rotation` | -90–90 | 0 | Z-axis flat rotation (degrees) |
| `showOuter` | bool | false | Outer circle / meridian rings gate |
| `showInner` | bool | true | Inner rolling circles |
| `showRails` | bool | false | Diameter lines |
| `showConnections` | bool | false | Orbit circle + centre dots + connection lines |
| `showCrown` | bool | false | Radial tick lines outside the main circle |
| `phase` | bool | false | "Rolling" — Tusi couple phase mode |
| `overlap` | bool | false | Dots ride the rim instead of oscillating on diameters |
| `meridians` | 0–12 | 0 | Wireframe-sphere ring count (>1 activates the sphere) |
| `meridianSpread` | 0–360 | 360 | Ring tumble magnitude; 0 collapses rings onto the main outline |
| `meridianDraw` | 0–100 | 100 | Ring entrance progress (rotate+fade cascade) |
| `spinRings` | bool | false | Continuous per-ring drift |
| `orbit` | bool | false | Ring-dot mode: one dot per ring (numRails = ring count), cycled palette dot colours, `ringSpinScale = speed/20` |
| `multiplyDots` | bool | false | dots composite with `multiply` (site default for every section) |
| `heroOverlay` | bool | false | Homepage hero: hard-light overlay dot layer + intro base-colour dots over opaque `#FAFAF8` |

## Raw component props (also accepted in `?params`)

Any `TusiAnimation` prop name is applied directly (wins over the derivation):
`pan`, `restTilt`, `restPan`, `crownDensity` (default 20), `dotStagger`,
`dotScale`, `uniformDots`, `railSpacing`, `clampXOffset`, `yOffset`,
`restPhase`, `settle`, `circleColor` (default `#C7BDB2`), `dotColors`,
`dotScales`, `uniformSpin`, `ringSpinScale`, `peelRings`, `ringSeed`,
`solidRings`, `ringOrbit`, `activeRing`, `spinDriver`, `flatHalo`,
`ringDotColors`, `ringDotScales`, `showIntersections`, `dotBlendMode`,
`overlayDots`, `baseColorFade`, `background`, `ringDots`, `meridians`.

Colour constants (inlined from `lib/colors.tsx`): brand `#65D9EE`,
accentOrange `#FF7C0F`, accentYellow `#FEDE59`, accentBrown `#AD5913`,
ring/linework `#C7BDB2`, page `#FAFAF8`.

## Example export commands

Run from `tribe-design/` (the skill root; playwright-core lives in `scripts/`).

```sh
# Still — home hero, 1200x1200
node scripts/render.mjs --html animation/tool/tusi.html \
  --query 'preset=home&size=1200' \
  --out out/tusi-home.png --width 1200 --height 1200 --transparent

# Still — orbit constellation, transparent, later frame for variety
node scripts/render.mjs --html animation/tool/tusi.html \
  --query 'preset=orbit&size=1200&t=6' \
  --out out/tusi-orbit.png --width 1200 --height 1200 --transparent

# Still — custom params (URI-encode the JSON)
node scripts/render.mjs --html animation/tool/tusi.html \
  --query 'params=%7B%22numRails%22%3A4%2C%22showOuter%22%3Atrue%2C%22showInner%22%3Atrue%2C%22showRails%22%3Atrue%2C%22trailSize%22%3A15%2C%22tilt%22%3A30%2C%22dotSize%22%3A18%2C%22speed%22%3A20%2C%22circleSize%22%3A40%7D&background=transparent&t=5' \
  --out out/tusi-custom.png --width 1200 --height 1200 --transparent

# Motion — 4s WEBM of the orbit preset
node scripts/render.mjs --html animation/tool/tusi.html \
  --query 'preset=orbit&play=1' \
  --webm out/tusi.webm --duration 4000 --width 1000 --height 1000
```

High-res: page screenshots rasterise at viewport × `--scale` (default 2), so
`--width 1200 --scale 2` → 2400px output. For a true high-res transparent
crop, use the in-page exporter instead — it reads the backing store (sized by
`?size`, default 2000 longest edge) and ports the alpha-bbox trim from
`generators/download.ts`:

```js
// via playwright: page.evaluate(() => window.__EXPORT_PNG__({ trim: true, padding: 0.1 }))
// → PNG dataURL, cropped to the figure + 10% margin, transparent
```

## Fidelity caveats

- **Scroll-driven features are pinned to their scrollY=0 resting state** (the
  same state the studio shows): hero-text and scroll-sentence rendering are
  omitted (dormant without those props), `baseColorFade` sits at its intro
  colours (`#0A99C3` blue / `#FEDE59` yellow on the home preset — matching the
  resting homepage hero), the `shift.selector` second-stage recolour never
  fires (no DOM sections), and the overlay-dot scroll fade stays at full.
- **Presets are the studio's "faithful-but-not-pixel-exact" section starting
  points**: like the studio, they drop the website's `pan`/`dotStagger`/
  `dotScale`/fraction-of-viewport `xOffset` per-section values. Pass those as
  raw props for closer site parity.
- **`showIntersections` defaults to false** (the studio always passes false);
  the component's own default is true. Override via params if you want the
  ring-crossing dots.
- **Stills are deterministic**: frames are simulated at exactly 60fps from
  t=0, so the same `?t` always yields the same image. Dots fade in over the
  first ~0.2s (as on the site), so use `t >= 1`.
- **Figure size vs viewport**: `circleSize` is % of min(W,H); the home/model
  presets (60) intentionally bleed past a square viewport exactly like the
  full-bleed website sections. Use a wider viewport or smaller `circleSize`
  to fit the whole figure; the colored rail dots of `model` need a wide
  viewport (e.g. 1600x1000) to be in frame.
- **`what-we-do` preset** has `meridianSpread: 0`, so its 8 meridians are
  fully converged (invisible) and the main outline is solid — this matches
  the site's settled S1 state.
- **WEBM** is a real-time page recording (Playwright); the figure animates
  from `?t` pre-roll onward. Frame drops are possible on slow machines, same
  as the site's own MediaRecorder export.
- Mobile-only branches (viewport width < 768: outline thinning, intro rise,
  right-bleed clamp) are ported as-is and will engage on narrow viewports.
