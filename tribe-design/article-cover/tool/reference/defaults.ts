import type { NodeSettings } from './types';

// Sample photos are served from the Next public dir at /node-generator/samples/.
const BASE = '/node-generator/';

export const SAMPLE_IMAGES: ReadonlyArray<string> = [
  `${BASE}samples/dunes.jpg`,
  `${BASE}samples/taro-leaf.jpg`,
  `${BASE}samples/fern-fronds.jpg`,
  `${BASE}samples/river-valley.jpg`,
  `${BASE}samples/mountain-ridge.jpg`,
  `${BASE}samples/pancake-rocks.jpg`,
  `${BASE}samples/sandstone.jpg`,
  `${BASE}samples/painted-hills.jpg`,
  `${BASE}samples/badlands.jpg`,
  `${BASE}samples/cliffs.jpg`,
  `${BASE}samples/brown-layers.jpg`,
  `${BASE}samples/rock-flow.jpg`,
  `${BASE}samples/voxel-tunnel.webp`,
  `${BASE}samples/glass-orb.webp`,
  `${BASE}samples/ribbons.webp`,
  `${BASE}samples/poppies.webp`,
  `${BASE}samples/sunflower.webp`,
  `${BASE}samples/moon.webp`,
  `${BASE}samples/pressed-flora.webp`,
  `${BASE}samples/skylight-grid.webp`,
  `${BASE}samples/glass-roof.webp`,
  `${BASE}samples/truss-canopy.webp`,
  `${BASE}samples/sand-ripples.webp`,
  `${BASE}samples/monstera.webp`,
  `${BASE}samples/tulip-bed.webp`,
  `${BASE}samples/motion-blur.webp`,
];

export function randomSample(): string {
  return SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
}

export const DEFAULT_NODE_SETTINGS: NodeSettings = {
  density: 800,
  thresholdRange: { min: 0, max: 50 },
  gamma: 1,
  dotScale: 1,
  lineScale: 1,
  distance: 3,
  grid: false,
  routing: 'strict',
  dirAngle: 0,
  dirSpread: 30,
  traceBranch: 3,
  fill: false,
  dotOutline: false,
  dotOutlineWidth: 0.25,
  dotColorKey: 'color9',
  lineColorKey: 'color9',
  nuances: [],
  seed: 0,
  imageOffsetX: 0,
  imageOffsetY: 0,
};
