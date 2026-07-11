// Helpers for the "SVG layer" — a user-uploaded vector dropped into the
// composition as its own layer, recolored to a single palette swatch and
// centered/contain-fit in the frame. buildSvgLayerMarkup produces ONE SVG
// string in the composition's coordinate space (0..w, 0..h, matching
// NodeCanvas's exporter), so the live preview, the SVG export, and the PNG
// raster are all built from the same markup.

type ViewBox = { x: number; y: number; w: number; h: number };

// The uploaded SVG's coordinate box, from its viewBox or width/height (fallback 100×100).
function parseViewBox(raw: string): ViewBox {
  const vb = /viewBox\s*=\s*"([^"]+)"/.exec(raw);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every((n) => !Number.isNaN(n)) && p[2] > 0 && p[3] > 0) {
      return { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
  }
  const wM = /width\s*=\s*"([\d.]+)/.exec(raw);
  const hM = /height\s*=\s*"([\d.]+)/.exec(raw);
  const w = wM ? Number(wM[1]) : 100;
  const h = hM ? Number(hM[1]) : 100;
  return { x: 0, y: 0, w: w > 0 ? w : 100, h: h > 0 ? h : 100 };
}

// Everything between the outer <svg …> and </svg>.
function innerMarkup(raw: string): string {
  return raw.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

// Recolor to a single tint: rewrite explicit fills/strokes (leaving `none`
// intact so line icons keep their open shapes); a default fill on the wrapping
// <g> covers elements with no fill of their own.
function tint(inner: string, color: string): string {
  return inner
    .replace(/fill="(?!none")[^"]*"/gi, `fill="${color}"`)
    .replace(/stroke="(?!none")[^"]*"/gi, `stroke="${color}"`)
    .replace(/fill:\s*(?!none)[^;"']+/gi, `fill:${color}`)
    .replace(/stroke:\s*(?!none)[^;"']+/gi, `stroke:${color}`);
}

/** Build the layer's SVG in composition space: the uploaded vector tinted to
 *  `color` and contain-fit into a centered box of `scale`×(w,h). */
export function buildSvgLayerMarkup(raw: string, color: string, scale: number, w: number, h: number): string {
  const vb = parseViewBox(raw);
  const inner = tint(innerMarkup(raw), color);
  const boxW = w * scale;
  const boxH = h * scale;
  const s = Math.min(boxW / vb.w, boxH / vb.h);
  const dw = vb.w * s;
  const dh = vb.h * s;
  const tx = (w - dw) / 2 - vb.x * s;
  const ty = (h - dh) / 2 - vb.y * s;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})" fill="${color}">${inner}</g>` +
    `</svg>`
  );
}

/** Light validation that an uploaded file is actually an SVG document. */
export function looksLikeSvg(text: string): boolean {
  return /<svg[\s>]/i.test(text);
}
