---
name: tribe-design-diagram
description: Create deterministic Tribe-branded system diagrams and flowcharts from JSON, with SVG and PNG output. Use for architecture diagrams, workflows, decision flows, system maps, process visuals, or diagrams embedded in Tribe decks, documents, and web pages.
---

# Tribe Design — System Diagram

Tribe-branded system diagrams and flowcharts from JSON — you author nodes +
edges, a deterministic engine lays them out and renders SVG/PNG. Pure Node,
no browser needed for SVG.

## Workflow

1. **Author** a diagram JSON — nodes (id, label, shape, color) and edges
   (from, to, label, caps). Start from `tool/examples/system-architecture.json`
   or `tool/examples/flowchart-decision.json`.
2. **Render**: `node tool/diagram.mjs input.json --out out.svg --png out.png`
3. **Check the PNG visually** before delivering; iterate on JSON order (it's
   a layout hint) if the flow reads badly.

**`tool/NOTES.md` is the full schema + authoring reference.** Read it before
authoring.

## Authoring essentials

- **Shapes convey meaning**: `rounded` services (default) · `rect` data
  stores · `pill` start/end/external actors · `diamond` decisions · `ellipse`
  events/concepts.
- **Color sparingly**: most nodes `default` (white); accents only to group or
  highlight — 2–3 accent colors max per diagram. Palette: `brand` (cyan),
  `teal`, `ocean`, `brown`, `orange`, `yellow`, `dark`.
- **4–14 nodes.** Labels 1–4 words; `subLabel` for detail. Edge labels only
  when they clarify ("reads/writes"); `dashed` for secondary/async flows.
- **Badges** (`kind: "badge"`, snapped to a parent corner with `anchor`) for
  numbered step callouts.
- **Layout**: omit x/y everywhere and list nodes in natural flow order —
  auto-layout does the rest. Manual layout = give EVERY node x/y (+ w/h).
  Auto-layout needs an acyclic flow: for feedback loops ("iterate", retries),
  go manual and route the loop edge with waypoints through a gap between
  nodes (see `tool/NOTES.md` caveats).

## Using the output

SVG scales cleanly into decks (`../deck-builder`), documents (`../documents`),
and web pages. Default export is transparent; set `"exportBackground": true`
for a standalone artifact on paper `#FAFAF8`.

## Don'ts

❌ Rainbow node coloring · ❌ prose in labels · ❌ crossing-heavy manual
layouts when auto would do · ❌ labeling every edge · ❌ more than ~14 nodes in
one diagram — split it.
