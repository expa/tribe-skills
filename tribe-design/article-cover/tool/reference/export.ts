import { DEFAULT_NODE_SETTINGS } from './defaults';
import { computeStack, type NodeApp } from './state/NodeApp';
import { recordCanvasVideo } from '../generators/download';
import { buildZip } from '../generators/zip';
import { progressAtTime, type CoverAnimator } from './coverAnimation';

/** Chosen output for the intro-reveal export. */
export type AnimExportFormat = 'webm' | 'mp4' | 'frames';

/** Fixed export height; width follows the current cover aspect. */
const EXPORT_HEIGHT = 2160;
const EXPORT_FPS = 30;

async function writeTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fall through to legacy path
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-10000px';
  ta.setAttribute('readonly', '');
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

// Build the merged SVG string for the whole layer stack (render-stack order,
// background rect first). Returns null if the SVG exporters aren't ready.
export function buildNodeSvg(app: NodeApp): string | null {
  const parent = app.layer;
  // Composite in render-stack order so the export matches the canvas exactly.
  const ids: string[] = computeStack(parent).map((e) => e ?? parent.id);
  const exporters = ids
    .map((id) => app.nodeSvgExporters.get(id))
    .filter((fn): fn is () => string => Boolean(fn));
  if (exporters.length === 0) return null;

  const svgs = exporters.map((fn) => fn());
  const openMatch = /<svg[^>]*>/.exec(svgs[0]);
  if (!openMatch) return null;
  const openTag = openMatch[0];
  const stripWrapper = (s: string): string =>
    s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // Background fill first, then the layers in render-stack order. (The edge fade is baked
  // into each layer's sampled points, so nothing extra to draw here.)
  const bgRect = `<rect x="0" y="0" width="100%" height="100%" fill="${app.palette[app.backgroundColorKey]}"/>`;
  return openTag + bgRect + svgs.map(stripWrapper).join('') + '</svg>';
}

export async function copyNodeSvgToClipboard(app: NodeApp): Promise<void> {
  const merged = buildNodeSvg(app);
  if (!merged) {
    window.alert('Node SVG export not ready — make sure the canvas has finished sampling.');
    return;
  }
  await writeTextToClipboard(merged);
}

export function downloadNodeSvg(app: NodeApp): void {
  const merged = buildNodeSvg(app);
  if (!merged) {
    window.alert('Node SVG export not ready — make sure the canvas has finished sampling.');
    return;
  }
  triggerDownload(new Blob([merged], { type: 'image/svg+xml' }), `node-artwork-${Date.now()}.svg`);
}

// Composite the layer stack into a single raster blob, in render-stack order so
// it matches the on-screen canvas exactly. Returns null if the canvases aren't
// ready yet.
export async function exportNodeRasterBlob(
  app: NodeApp,
  format: 'png' | 'webp' = 'png',
): Promise<Blob | null> {
  const parent = app.layer;
  const ids: string[] = computeStack(parent).map((e) => e ?? parent.id);
  const canvases = ids
    .map((id) => app.nodeCanvases.get(id))
    .filter((c): c is HTMLCanvasElement => Boolean(c));
  if (canvases.length === 0) return null;

  const out = document.createElement('canvas');
  out.width = canvases[0].width;
  out.height = canvases[0].height;
  const octx = out.getContext('2d');
  if (!octx) return null;
  const bg = app.palette[app.backgroundColorKey];
  if (bg) {
    octx.fillStyle = bg;
    octx.fillRect(0, 0, out.width, out.height);
  }
  for (const c of canvases) octx.drawImage(c, 0, 0, out.width, out.height);

  const mime = format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, mime, format === 'webp' ? 0.95 : undefined),
  );
}

// Kept (name + signature) for the CMS cover picker, which stages a PNG data URL.
export async function exportNodePngBlob(app: NodeApp): Promise<Blob | null> {
  return exportNodeRasterBlob(app, 'png');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadNodeImage(app: NodeApp, format: 'png' | 'webp'): Promise<void> {
  const blob = await exportNodeRasterBlob(app, format);
  if (!blob) {
    window.alert('Node canvas not ready yet.');
    return;
  }
  triggerDownload(blob, `node-artwork-${Date.now()}.${format}`);
}

export async function downloadNodePng(app: NodeApp): Promise<void> {
  return downloadNodeImage(app, 'png');
}

/** Output dimensions for the reveal export: fixed 2160p height, width from the current
 *  cover aspect, rounded to even (MediaRecorder / VP9 want even dims). */
export function animationExportDimensions(aspectW: number, aspectH: number): { w: number; h: number } {
  const h = EXPORT_HEIGHT;
  let w = Math.round(h * (aspectW / aspectH));
  if (w % 2) w += 1;
  return { w, h };
}

// Export the intro "wash" reveal at a true 2160p. All three formats composite the
// layer stack (render-stack order, over the palette background) onto an offscreen
// canvas — matching the raster export exactly — while the shared animator drives every
// on-screen layer through the reveal at high resolution (renderScale bump):
//   • webm / mp4 — a real-time MediaRecorder capture (may drop frames under load) at a
//     generous bitrate for the lowest compression the browser will honour.
//   • frames — an offline, deterministic image sequence: every frame is stepped and
//     fully rendered (no dropped frames), packaged as a .zip of PNGs.
export async function downloadNodeAnimation(
  app: NodeApp,
  animator: CoverAnimator,
  format: AnimExportFormat,
): Promise<void> {
  const parent = app.layer;
  const ids: string[] = computeStack(parent).map((e) => e ?? parent.id);
  const canvases = ids
    .map((id) => app.nodeCanvases.get(id))
    .filter((c): c is HTMLCanvasElement => Boolean(c && c.width && c.height));
  if (canvases.length === 0) {
    window.alert('Node canvas not ready yet.');
    return;
  }

  const srcW = canvases[0].width;
  const srcH = canvases[0].height;
  const { w: outW, h: outH } = animationExportDimensions(srcW, srcH);
  // renderScale is 1 outside this function, so srcW === the layer's normal render width;
  // this makes each layer's backing store ~outW wide → a real 2160p render, not an upscale.
  animator.renderScale = outW / srcW;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) {
    animator.renderScale = 1;
    return;
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  const bg = app.palette[app.backgroundColorKey];

  const compose = (): void => {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) {
      octx.fillStyle = bg;
      octx.fillRect(0, 0, out.width, out.height);
    } else {
      octx.clearRect(0, 0, out.width, out.height);
    }
    for (const c of canvases) octx.drawImage(c, 0, 0, out.width, out.height);
  };

  const stamp = Date.now();
  try {
    if (format === 'frames') {
      const blob = await renderFrameSequence(animator, compose, out);
      triggerDownload(blob, `node-cover-frames-${outH}p-${stamp}.zip`);
    } else {
      // ~0.4 bits/pixel/frame — visually near-lossless for this flat vector artwork.
      const bitsPerSecond = Math.round(outW * outH * EXPORT_FPS * 0.4);
      // Seed the first captured frame as bare background (the reveal's starting state).
      compose();
      const recording = recordCanvasVideo(out, animator.totalMs(), EXPORT_FPS, format, bitsPerSecond);
      await animator.play({ onFrame: compose });
      const blob = await recording;
      triggerDownload(blob, `node-cover-animation-${outH}p-${stamp}.${format}`);
    }
  } finally {
    // Return the on-screen layers to preview resolution and the static render.
    animator.stop();
    animator.renderScale = 1;
    animator.requestRedraw();
  }
}

// Deterministic, offline render of the whole reveal (lead + sweep + tail) to a PNG
// sequence, zipped. Steps the animator frame-by-frame off a synthetic clock — each
// frame is fully rendered before capture, so nothing is dropped regardless of how
// long a 2160p frame takes.
async function renderFrameSequence(
  animator: CoverAnimator,
  compose: () => void,
  out: HTMLCanvasElement,
): Promise<Blob> {
  const frameCount = Math.round((animator.totalMs() / 1000) * EXPORT_FPS) + 1;
  const pad = String(frameCount - 1).length;
  const entries: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
  for (let i = 0; i < frameCount; i++) {
    const ms = (i / EXPORT_FPS) * 1000;
    animator.renderAt(progressAtTime(ms));
    compose();
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) continue;
    const data = new Uint8Array(await blob.arrayBuffer());
    entries.push({ name: `frame_${String(i).padStart(pad, '0')}.png`, data });
  }
  return buildZip(entries);
}

export function downloadNodePreset(app: NodeApp): void {
  const layer = app.layer;
  const preset = {
    kind: 'node-generator-preset',
    version: 1,
    exportedAt: new Date().toISOString(),
    nodeSettings: layer.nodeSettings ?? { ...DEFAULT_NODE_SETTINGS },
    nodeSubLayers: (layer.nodeSubLayers ?? []).map((s) => ({ settings: s.settings })),
    parentStackIndex: layer.parentStackIndex ?? 0,
    theme: app.themeName,
    palette: { ...app.palette },
    backgroundColorKey: app.backgroundColorKey,
  };
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `node-preset-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
