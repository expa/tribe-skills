import type { NodePaletteKey, Palette } from './types';

/** A named color theme extracted from the Tribe AI brand frames in Figma
 *  (file Keb2A7dvi9sS4O7mGBsKwc, node 666:18887 "Color themes").
 *
 *  Slot roles — every theme fills the ten palette slots so that the keys
 *  presets already reference resolve to an on-theme color:
 *    color1  highlight: light pop     color6  canvas background
 *    color2  highlight: contrast pop  color7  primary lines
 *    color3  trace lines              color8  grid accent / third pop
 *    color4  trace nodes              color9  primary dots
 *    color5  deep accent              color10 ink / darkest
 *
 *  color1/color2 (and occasionally color8) are the slots preset highlight
 *  passes (NodeNuance.colorKey) reference — in the Figma frames these are the
 *  sparse 2-4% accent dots sprinkled through each dot field.
 */
export interface Theme {
  name: string;
  palette: Palette;
  backgroundColorKey: NodePaletteKey;
}

export const THEMES: Theme[] = [
  // ── Cyan / teal / blue grounds (light → deep) ─────────────────────────────
  {
    // Figma frame "1" — light cyan field, cyan dots, teal + white pops, rust traces.
    name: 'Pool',
    palette: {
      color1: '#FAFAF8',
      color2: '#3B89A8',
      color3: '#E9712E',
      color4: '#A14000',
      color5: '#6B3209',
      color6: '#95FCFB',
      color7: '#65D9EE',
      color8: '#3B89A8',
      color9: '#3B89A8',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
  {
    // Figma frame 666:27437 — cyan field, light dots, yellow/orange grid traces.
    name: 'Lagoon',
    palette: {
      color1: '#EBEBE2',
      color2: '#FB6411',
      color3: '#FFC336',
      color4: '#E88B1C',
      color5: '#A4500B',
      color6: '#65D9EE',
      color7: '#95FCFB',
      color8: '#E88B1C',
      color9: '#95FCFB',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
  {
    // brand #65D9EE → #07404F — the moody counterpart to Lagoon, with an orange pop.
    name: 'Brand',
    palette: {
      color1: '#B2F3FF',
      color2: '#07404F',
      color3: '#07404F',
      color4: '#B2F3FF',
      color5: '#0D4E6E',
      color6: '#65D9EE',
      color7: '#B2F3FF',
      color8: '#FF7C0F',
      color9: '#07404F',
      color10: '#07404F',
    },
    backgroundColorKey: 'color6',
  },
  {
    // Design-system pair accentTeal #0A99C3 → #B2F3FF, with brand cyan as the mid shade
    // and yellow/orange cross-accent pops for highlights.
    name: 'Teal',
    palette: {
      color1: '#B2F3FF',
      color2: '#FEDE59',
      color3: '#07404F',
      color4: '#B2F3FF',
      color5: '#0D4E6E',
      color6: '#0A99C3',
      color7: '#65D9EE',
      color8: '#FF7C0F',
      color9: '#B2F3FF',
      color10: '#07404F',
    },
    backgroundColorKey: 'color6',
  },
  {
    // accentOcean #0D4E6E → #BEE6F5, with teal/brand mids and yellow/orange pops.
    name: 'Ocean',
    palette: {
      color1: '#BEE6F5',
      color2: '#FEDE59',
      color3: '#65D9EE',
      color4: '#BEE6F5',
      color5: '#07404F',
      color6: '#0D4E6E',
      color7: '#0A99C3',
      color8: '#FF7C0F',
      color9: '#BEE6F5',
      color10: '#07404F',
    },
    backgroundColorKey: 'color6',
  },

  // ── Yellow / gold grounds (light → deep) ──────────────────────────────────
  {
    // accentYellow #FEDE59 → #7C6503, with the derived olive-gold #BDA12E and a teal pop.
    name: 'Yellow',
    palette: {
      color1: '#FAFAF8',
      color2: '#7C6503',
      color3: '#BDA12E',
      color4: '#7C6503',
      color5: '#AD5913',
      color6: '#FEDE59',
      color7: '#FF7C0F',
      color8: '#0A99C3',
      color9: '#7C6503',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
  {
    // Figma frame "3" — yellow field, orange/light-yellow dots, near-black traces.
    name: 'Solar',
    palette: {
      color1: '#EBEBE2',
      color2: '#FFE25C',
      color3: '#06141C',
      color4: '#FB6411',
      color5: '#A4500B',
      color6: '#FFC336',
      color7: '#E88B1C',
      color8: '#FFE25C',
      color9: '#06141C',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },

  // ── Orange ground ─────────────────────────────────────────────────────────
  {
    // accentOrange #FF7C0F → #6D1D00, with the derived mid #B64C07 and peach/yellow pops.
    name: 'Orange',
    palette: {
      color1: '#FEDE59',
      color2: '#6D1D00',
      color3: '#6D1D00',
      color4: '#F4C29D',
      color5: '#B64C07',
      color6: '#FF7C0F',
      color7: '#F4C29D',
      color8: '#FEDE59',
      color9: '#6D1D00',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },

  // ── Brown / clay / rust grounds (light → deep) ────────────────────────────
  {
    // Terracotta on warm peach (#F4C29D, the accentBrown contrast shade) — vivid orange
    // dots and rust traces with cream + cyan pops and a yellow third accent. A vibrant
    // clay field, sitting between the bone-paper themes and the loud Orange/Brown ones.
    name: 'Terra',
    palette: {
      color1: '#FAFAF8',
      color2: '#65D9EE',
      color3: '#A14000',
      color4: '#6D1D00',
      color5: '#6B3209',
      color6: '#F4C29D',
      color7: '#B64C07',
      color8: '#FEDE59',
      color9: '#FB6411',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
  {
    // Caramel #D08D58 field (the accentBrown mid) — fired clay: umber dots, rust lines,
    // cream + cyan + yellow pops. Lighter, warmer sibling of Brown.
    name: 'Clay',
    palette: {
      color1: '#FAFAF8',
      color2: '#65D9EE',
      color3: '#6D1D00',
      color4: '#F4C29D',
      color5: '#6B3209',
      color6: '#D08D58',
      color7: '#A14000',
      color8: '#FEDE59',
      color9: '#6D1D00',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
  {
    // accentBrown #AD5913 → #F4C29D, plus the derived mid #D08D58 and yellow pops, with
    // a small dose of the blue shades (pale #B2F3FF + teal #0A99C3) in the highlight slots.
    name: 'Brown',
    palette: {
      color1: '#B2F3FF',
      color2: '#FEDE59',
      color3: '#6D1D00',
      color4: '#F4C29D',
      color5: '#6D1D00',
      color6: '#AD5913',
      color7: '#D08D58',
      color8: '#0A99C3',
      color9: '#F4C29D',
      color10: '#6D1D00',
    },
    backgroundColorKey: 'color6',
  },
  {
    // Figma frame "2" — rust field, orange dots, yellow traces with white nodes, cyan pops.
    name: 'Ember',
    palette: {
      color1: '#EBEBE2',
      color2: '#65D9EE',
      color3: '#FFC336',
      color4: '#EBEBE2',
      color5: '#A14000',
      color6: '#A4500B',
      color7: '#E9712E',
      color8: '#65D9EE',
      color9: '#FB6411',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },

  // ── Neutral ground ────────────────────────────────────────────────────────
  {
    // background-tertiary #C7BDB2 taupe — desert field, ink lines, deep-brown dots,
    // orange + teal pops.
    name: 'Sand',
    palette: {
      color1: '#FAFAF8',
      color2: '#FF7C0F',
      color3: '#6B3209',
      color4: '#06141C',
      color5: '#6D1D00',
      color6: '#C7BDB2',
      color7: '#06141C',
      color8: '#0A99C3',
      color9: '#6B3209',
      color10: '#06141C',
    },
    backgroundColorKey: 'color6',
  },
];

export const DEFAULT_THEME = THEMES[0];

/** Swatches shown on a theme's selector chip: the background leads (it dominates the
 *  composition), then EVERY other distinct palette color gets an equal stripe, so no shade
 *  in the theme is hidden from the picker. Duplicate hexes collapse to one stripe. */
export interface ThemeSwatch {
  color: string;
  weight: number;
}

const PALETTE_ORDER: NodePaletteKey[] = [
  'color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7', 'color8', 'color9', 'color10',
];

export function themePreviewSwatches(theme: Theme): ThemeSwatch[] {
  const p = theme.palette;
  const bg = p[theme.backgroundColorKey];
  const seen = new Set<string>([bg.toUpperCase()]);
  const swatches: ThemeSwatch[] = [{ color: bg, weight: 3 }];
  for (const key of PALETTE_ORDER) {
    const c = p[key];
    const id = c.toUpperCase();
    if (seen.has(id)) continue;
    seen.add(id);
    swatches.push({ color: c, weight: 1 });
  }
  return swatches;
}
