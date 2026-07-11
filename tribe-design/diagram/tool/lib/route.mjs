// Orthogonal edge routing. Every edge is drawn with only horizontal/vertical
// segments (90° bends, no diagonals). An arrow attaches to the CENTRE of a
// node's side; when several arrows share the same side of a node, they're
// distributed evenly along it (space-around). Port of website lib/diagram/route.ts.
//
// @typedef {{x:number,y:number}} Pt
// @typedef {{id:string,label?:string,dashed?:boolean,points:Pt[],labelPos:Pt}} RoutedEdge

const STUB = 22 // px the line travels straight out of a node before bending

const DIR = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// When a lone arrow connects two facing sides, we slide both attach points to a
// shared coordinate inside the sides' overlap so the line runs straight instead
// of kinking.
const STRAIGHTEN_MARGIN = 8
const STRAIGHTEN_MIN_OVERLAP = 20

const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 })

const sideFromDelta = (dx, dy) =>
  Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'

// The facing sides for an edge A→B, based on the dominant axis between centres.
function sidesFor(a, b) {
  const ac = center(a)
  const bc = center(b)
  const s = sideFromDelta(bc.x - ac.x, bc.y - ac.y)
  const opp = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
  return [s, opp[s]]
}

// A badge snapped to a node attaches on the side facing AWAY from that node, so
// its arrows leave outward and avoid the parent. Returns null otherwise.
function badgeOutwardSide(node, byId) {
  if (node.kind !== 'badge' || !node.parentId) return null
  const parent = byId.get(node.parentId)
  if (!parent) return null
  const nc = center(node)
  const pc = center(parent)
  return sideFromDelta(nc.x - pc.x, nc.y - pc.y)
}

function attachPoint(n, side, t) {
  switch (side) {
    case 'left':
      return { x: n.x, y: n.y + t * n.h }
    case 'right':
      return { x: n.x + n.w, y: n.y + t * n.h }
    case 'top':
      return { x: n.x + t * n.w, y: n.y }
    case 'bottom':
    default:
      return { x: n.x + t * n.w, y: n.y + n.h }
  }
}

// Drop duplicate + collinear points so the polyline is minimal.
function simplify(pts) {
  const dedup = []
  for (const p of pts) {
    const last = dedup[dedup.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue
    dedup.push(p)
  }
  const res = []
  for (let i = 0; i < dedup.length; i++) {
    const prev = res[res.length - 1]
    const cur = dedup[i]
    const next = dedup[i + 1]
    if (prev && next) {
      const colX = Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5
      const colY = Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5
      if (colX || colY) continue
    }
    res.push(cur)
  }
  return res
}

const RECT_MARGIN = 8 // keep routed lines this far clear of a node's box

// Does an axis-aligned segment (p→q) come within RECT_MARGIN of rect `r`?
function segHitsRect(p, q, r) {
  return (
    Math.max(p.x, q.x) > r.x - RECT_MARGIN &&
    Math.min(p.x, q.x) < r.x + r.w + RECT_MARGIN &&
    Math.max(p.y, q.y) > r.y - RECT_MARGIN &&
    Math.min(p.y, q.y) < r.y + r.h + RECT_MARGIN
  )
}

// Orthogonal polyline from p1 (leaving in d1) to p2 (entering along d2). The
// perpendicular stubs guarantee the arrow exits/enters its nodes cleanly; the
// bit in between is a plain elbow/Z. When sides are pinned, the naive elbow can
// bend back THROUGH a node, so we score a few candidate link shapes against the
// two endpoint boxes and pick the first that clears them.
function orthPoints(p1, d1, p2, d2, src, tgt) {
  const a = { x: p1.x + d1.x * STUB, y: p1.y + d1.y * STUB }
  const b = { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB }
  const h1 = d1.y === 0
  const h2 = d2.y === 0
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const VH = [{ x: a.x, y: b.y }]
  const HV = [{ x: b.x, y: a.y }]
  const Zv = (x) => [{ x, y: a.y }, { x, y: b.y }]
  const Zh = (y) => [{ x: a.x, y }, { x: b.x, y }]
  // Preference order — the first entry reproduces the original routing per case.
  let order
  if (h1 && h2) order = [Zv(mx), Zh(my), HV, VH]
  else if (!h1 && !h2) order = [Zh(my), Zv(mx), VH, HV]
  else if (h1) order = [HV, VH, Zv(mx), Zh(my)]
  else order = [VH, HV, Zh(my), Zv(mx)]
  // Detours whose linking leg runs beyond BOTH nodes.
  order.push(Zv(Math.max(a.x, b.x) + STUB), Zv(Math.min(a.x, b.x) - STUB), Zh(Math.max(a.y, b.y) + STUB), Zh(Math.min(a.y, b.y) - STUB))

  const rects = [src, tgt].filter((r) => !!r)
  let best = order[0]
  let bestHits = Infinity
  for (const c of order) {
    const link = [a, ...c, b]
    let hits = 0
    for (let i = 0; i < link.length - 1; i++) for (const r of rects) if (segHitsRect(link[i], link[i + 1], r)) hits++
    if (hits < bestHits) { bestHits = hits; best = c; if (hits === 0) break }
  }
  return simplify([p1, a, ...best, b, p2])
}

// Orthogonal polyline from p1 (leaving in d1) through a list of forced waypoints
// to p2 (entering along d2). Consecutive points are joined by an L-corner using a
// single, uniform orientation (seeded by the exit axis so the stub flows straight
// into the first leg). Every segment stays horizontal/vertical.
function orthThrough(p1, d1, wps, p2, d2) {
  const a = { x: p1.x + d1.x * STUB, y: p1.y + d1.y * STUB }
  const b = { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB }
  const chain = [a, ...wps, b]
  const verticalFirst = d1.x === 0 // leaving top/bottom → first leg is vertical
  const pts = [p1, a]
  for (let i = 1; i < chain.length; i++) {
    const u = chain[i - 1]
    const v = chain[i]
    const corner = verticalFirst ? { x: u.x, y: v.y } : { x: v.x, y: u.y }
    pts.push(corner, v)
  }
  pts.push(p2)
  return simplify(pts)
}

// Point at fraction `t` (0–1) of the total polyline length — where a label sits.
export function pointAtFraction(pts, t) {
  const segs = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    segs.push(l)
    total += l
  }
  let along = total * Math.max(0, Math.min(1, t))
  for (let i = 0; i < segs.length; i++) {
    if (along <= segs[i]) {
      const f = segs[i] ? along / segs[i] : 0
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f }
    }
    along -= segs[i]
  }
  return pts[pts.length - 1] ?? pts[0] ?? { x: 0, y: 0 }
}

// Build an SVG path `d` from a polyline, rounding each bend by up to `radius`
// (0 → sharp 90° corners).
export function edgePath(points, radius = 0) {
  if (points.length < 2) return ''
  if (radius <= 0 || points.length === 2) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1]
    const v = points[i]
    const n = points[i + 1]
    const lenPV = Math.hypot(v.x - p.x, v.y - p.y)
    const lenVN = Math.hypot(n.x - v.x, n.y - v.y)
    if (lenPV < 0.5 || lenVN < 0.5) continue
    const rr = Math.min(radius, lenPV / 2, lenVN / 2)
    const a = { x: v.x + ((p.x - v.x) / lenPV) * rr, y: v.y + ((p.y - v.y) / lenPV) * rr }
    const b = { x: v.x + ((n.x - v.x) / lenVN) * rr, y: v.y + ((n.y - v.y) / lenVN) * rr }
    d += ` L ${a.x} ${a.y} Q ${v.x} ${v.y} ${b.x} ${b.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

export function routeEdges(diagram) {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  const groups = new Map()
  const sides = new Map()

  const push = (key, ep) => {
    const arr = groups.get(key)
    if (arr) arr.push(ep)
    else groups.set(key, [ep])
  }

  for (const e of diagram.edges) {
    const from = byId.get(e.from)
    const to = byId.get(e.to)
    if (!from || !to) continue
    const [fs0, ts0] = sidesFor(from, to)
    // A manually-routed edge leaves each node toward its nearest waypoint.
    const wps = e.waypoints ?? []
    const fc = center(from)
    const tc = center(to)
    const fsW = wps.length ? sideFromDelta(wps[0].x - fc.x, wps[0].y - fc.y) : null
    const tsW = wps.length ? sideFromDelta(wps[wps.length - 1].x - tc.x, wps[wps.length - 1].y - tc.y) : null
    // Priority: badge-outward > explicitly pinned side > waypoint-derived > auto.
    const fs = badgeOutwardSide(from, byId) ?? e.fromSide ?? fsW ?? fs0
    const ts = badgeOutwardSide(to, byId) ?? e.toSide ?? tsW ?? ts0
    sides.set(e.id, { fromSide: fs, toSide: ts, from, to })
    push(`${from.id}:${fs}`, { edgeId: e.id, end: 'from', side: fs, other: to })
    push(`${to.id}:${ts}`, { edgeId: e.id, end: 'to', side: ts, other: from })
  }

  // Distribute endpoints along each shared side (space-around), ordered so
  // arrows don't cross more than necessary.
  const tByEndpoint = new Map()
  for (const eps of groups.values()) {
    const side = eps[0].side
    const vertical = side === 'left' || side === 'right'
    eps.sort((a, b) => {
      const ca = center(a.other)
      const cb = center(b.other)
      return vertical ? ca.y - cb.y : ca.x - cb.x
    })
    eps.forEach((ep, i) => tByEndpoint.set(`${ep.edgeId}:${ep.end}`, (i + 0.5) / eps.length))
  }

  const routed = []
  for (const e of diagram.edges) {
    const s = sides.get(e.id)
    if (!s) continue
    const tf = tByEndpoint.get(`${e.id}:from`) ?? 0.5
    const tt = tByEndpoint.get(`${e.id}:to`) ?? 0.5
    let p1 = attachPoint(s.from, s.fromSide, tf)
    let p2 = attachPoint(s.to, s.toSide, tt)
    const wps = e.waypoints ?? []

    // Straighten a side-by-side / stacked arrow. When the two sides face opposite
    // directions and their extents overlap enough, slide the LARGER node's
    // endpoint toward the other one so the arrow runs straight (avoiding the S-kink).
    const fromCount = groups.get(`${s.from.id}:${s.fromSide}`)?.length ?? 1
    const toCount = groups.get(`${s.to.id}:${s.toSide}`)?.length ?? 1
    if (!wps.length && OPPOSITE[s.fromSide] === s.toSide) {
      const horizontal = s.fromSide === 'left' || s.fromSide === 'right'
      const lo = horizontal ? Math.max(s.from.y, s.to.y) : Math.max(s.from.x, s.to.x)
      const hi = horizontal
        ? Math.min(s.from.y + s.from.h, s.to.y + s.to.h)
        : Math.min(s.from.x + s.from.w, s.to.x + s.to.w)
      if (hi - lo >= STRAIGHTEN_MIN_OVERLAP) {
        const fromBigger = s.from.w * s.from.h >= s.to.w * s.to.h
        const big = fromBigger ? s.from : s.to
        const count = fromBigger ? fromCount : toCount
        const m = Math.min(STRAIGHTEN_MARGIN, (hi - lo) / 2)
        if (horizontal) {
          const base = fromBigger ? p1.y : p2.y
          const desired = fromBigger ? p2.y : p1.y
          const limit = (big.h * 0.25) / count
          const y = clamp(clamp(desired, base - limit, base + limit), big.y + m, big.y + big.h - m)
          if (fromBigger) p1 = { ...p1, y }
          else p2 = { ...p2, y }
        } else {
          const base = fromBigger ? p1.x : p2.x
          const desired = fromBigger ? p2.x : p1.x
          const limit = (big.w * 0.25) / count
          const x = clamp(clamp(desired, base - limit, base + limit), big.x + m, big.x + big.w - m)
          if (fromBigger) p1 = { ...p1, x }
          else p2 = { ...p2, x }
        }
      }
    }

    const points = wps.length
      ? orthThrough(p1, DIR[s.fromSide], wps, p2, DIR[s.toSide])
      : orthPoints(p1, DIR[s.fromSide], p2, DIR[s.toSide], s.from, s.to)
    routed.push({ id: e.id, label: e.label, dashed: e.dashed, points, labelPos: pointAtFraction(points, e.labelT ?? 0.5) })
  }
  return routed
}
