// Tribe color palette — verbatim copy of website lib/colors.tsx (the canvas/JS
// source of truth). Only the hexes the diagram renderer needs, but kept whole so
// names stay identical to the site.
export const colors = {
  // Brand
  brand:                '#65D9EE',
  brandContrast:        '#07404F', // deep teal for text/graphics on a brand fill
  brandLight:           '#C3D0D8',

  // Foreground
  foregroundPrimary:    '#06141B',
  foregroundSecondary:  '#050F15',
  foregroundTertiary:   '#0A1D2B',

  // Hairline rules between stacked list rows (foregroundPrimary at 10%).
  divider:              'rgba(6, 20, 27, 0.1)',

  // Background
  backgroundPrimary:    '#FAFAF8',
  backgroundSoft:       '#F4F4F2',
  backgroundSecondary:  '#EBEBE2',
  backgroundTertiary:   '#C7BDB2',
  backgroundQuaternary: '#A9A197',

  // Logo tints
  logoTint:             '#8A8276',
  logoTintHighlight:    '#CFC9BD',

  // Accents (base + contrast pairs)
  accentBrown:          '#AD5913',
  accentBrownContrast:  '#F4C29D',
  accentOrange:         '#FF7C0F',
  accentOrangeContrast: '#6D1D00',
  accentYellow:         '#FEDE59',
  accentYellowContrast: '#7C6503',
  accentTeal:           '#0A99C3',
  accentTealContrast:   '#B2F3FF',
  accentOcean:          '#0D4E6E',
  accentOceanContrast:  '#BEE6F5',

  // Utility
  white:                '#FFFFFF',
}
