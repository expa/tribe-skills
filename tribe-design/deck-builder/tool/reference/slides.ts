import type { AccentName } from "./colors";
import type { SlideBackground } from "./deck-config";

// The layouts Claude can choose from. Keep this list and the renderer map in
// components/slides/SlideRenderer.tsx in sync.
export type LayoutId =
  | "cover"
  | "title"
  | "statement"
  | "bullets"
  | "contentImage"
  | "imageFull"
  | "quote"
  | "chapter"
  | "timeline"
  | "grid"
  | "stats"
  | "twoColumnDetail"
  | "feature"
  | "industry"
  | "agenda"
  | "logoWall"
  | "chart"
  | "textColumns";

export const LAYOUTS: { id: LayoutId; label: string; description: string }[] = [
  { id: "cover", label: "Cover", description: "Branded opening cover: logo lockup, big serif headline, date, and the Tusi figure. Use for the FIRST slide of a deck." },
  { id: "title", label: "Title", description: "Opening slide: big serif title, optional subtitle." },
  { id: "chapter", label: "Chapter", description: "Section divider: a big numeral/kicker + chapter title. Marks a new part of the deck." },
  { id: "statement", label: "Statement", description: "One bold serif line — a single idea or takeaway." },
  { id: "bullets", label: "Bullets", description: "Heading + a list of points (2–6). Can lay out in 1–5 columns." },
  { id: "contentImage", label: "Content + image", description: "Heading and body on one side, an image on the other." },
  { id: "imageFull", label: "Full-screen image", description: "A full-bleed image with the title (and optional subtitle) overlaid — like the cover but image-led." },
  { id: "grid", label: "Card grid", description: "A grid of cards, each with a short title and a line of body. Good for features, values, offerings." },
  { id: "timeline", label: "Timeline", description: "An ordered sequence of milestones, each with a label, title, and short body." },
  { id: "stats", label: "Stats", description: "A row of headline metrics — each a big number (title) with a short label (body). Great for impact/results." },
  { id: "twoColumnDetail", label: "Two-column detail", description: "Headline on the left, two columns of titled text blocks on the right. Good for explaining an approach in a few named parts." },
  { id: "feature", label: "Feature", description: "Headline + intro on the left, a large image in the middle (portrait/landscape/square), and short titled notes on the right." },
  { id: "industry", label: "Industry", description: "Title + muted subtitle, two body columns, a row of client logos, and a tall image. For an industry/segment overview." },
  { id: "quote", label: "Quote", description: "A pull quote with attribution." },
  { id: "agenda", label: "Agenda", description: "A section outline of what the deck covers — the title top-left and a 'Part I / II / III' list on the right, each item a short title (section) with an optional one-line detail. Good as the second slide." },
  { id: "logoWall", label: "Logo wall", description: "A heading with a grid of client/partner logos below. Uses the 'logos' image URLs." },
  { id: "chart", label: "Bar chart", description: "A vertical bar chart under the heading — each item is a bar (item.label = category e.g. 'Q1', item.title = the value e.g. '40'). Set item.highlight on one bar to accent it. Optional 'body' renders as a source caption." },
  { id: "textColumns", label: "Text columns", description: "A heading with 1–4 columns of plain paragraph text (the 'bullets' array, one paragraph each — no bullet markers). Good for a few short prose points side by side." },
];

// The structured content of a single slide. Claude returns this shape; the
// renderer reads it. Fields are optional per-layout — render nothing when empty
// (DESIGN.md: no placeholder fallbacks).
export interface SlideContent {
  layout: LayoutId;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  quote?: string;
  attribution?: string;
  accent?: AccentName;
  imageUrl?: string;
  imagePosition?: "left" | "right";
  columns?: number;         // bullets / grid: number of columns (1–5)
  kicker?: string;          // chapter: the big numeral/label, e.g. "01" or "Part One"
  items?: { label?: string; title?: string; body?: string; highlight?: boolean }[]; // grid cards / timeline / stats / twoColumnDetail / feature notes / industry columns / chart bars (highlight)
  logos?: string[];         // industry: client logo image URLs (uploaded)
  imageAspect?: "portrait" | "landscape" | "square"; // feature: image zone shape
  chartType?: "bar" | "paired" | "line"; // chart layout: single bars, paired bars, or a line chart (paired/line read item.body as the 2nd value)
  background?: SlideBackground; // per-slide surface override (undefined = inherit deck default)
  figure?: string;          // background animation top-right (a FigureId; see FIGURES)
  figurePaused?: boolean;   // freeze the figure to a static frame on this slide (no motion)
  figureRestPhase?: number; // when paused, the orbital phase (deg) the figure settles to — the chosen pose
  source?: string;          // provenance of grounded content, e.g. "Case study — Acme" (editor-only, never rendered on the slide)
  // Cover layout only:
  date?: string;            // small uppercase date/label under the headline, e.g. "MARCH 2026"
  partnerLogoUrl?: string;  // optional co-brand partner logo ("Tribe AI × Partner")
  // Per-slide chrome overrides — hide a global element on just this slide.
  // Per-slide chrome text overrides (blank/undefined = inherit the deck default).
  eyebrow?: string;         // this slide's eyebrow, overriding deck.eyebrow
  runningTitle?: string;    // this slide's running title, overriding deck.deckTitle
  hide?: {
    eyebrow?: boolean;
    runningTitle?: boolean;
    footer?: boolean;       // the footer text (deck.footer, e.g. "Confidential")
    footerLine?: boolean;   // the footer rule/hairline — independent of the text
    pageNumber?: boolean;
    logo?: boolean;
  };
}

export const EMPTY_SLIDE: SlideContent = { layout: "title" };

// The site's canvas animations a slide can run top-right in its background
// (same spirit as the cover's Tusi figure). Rendered by SlideFigure.tsx —
// "rose"/"honeycomb" also render static in thumbnails/print; the canvas-based
// ones (orbit/sphere/symbol) appear on live surfaces only.
export const FIGURES = [
  { id: "orbit", label: "Orbit" },        // the cover's dense Tusi orbital
  { id: "sphere", label: "Sphere" },      // homepage hero's tilted wireframe sphere
  { id: "symbol", label: "Symbol" },      // Tribe mark drawn by Fourier epicycles
  { id: "whatWeDo", label: "Tusi" },      // homepage #what-we-do section figure
  { id: "partners", label: "Rose" },      // homepage #partners section figure
  { id: "rose", label: "Rose" },          // lissajous rose, pulsing
  { id: "honeycomb", label: "Honeycomb" }, // lissajous honeycomb, building
] as const;
export type FigureId = (typeof FIGURES)[number]["id"];

// The cover's default date line, e.g. "JULY 2026" — covers are dated to when
// the deck is made (new deck, library template, or generation), not a placeholder.
export const deckDate = (d = new Date()): string =>
  `${d.toLocaleString("en-US", { month: "long" }).toUpperCase()} ${d.getFullYear()}`;
