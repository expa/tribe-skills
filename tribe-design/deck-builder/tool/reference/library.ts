import { deckDate, type SlideContent } from "./slides";

// Ready-to-use slide templates. Some carry real Tribe AI copy, some placeholder
// content to edit. Sales pick one and it's inserted into the deck. Keep these
// on-brand and concise (short titles, tight body).
export interface LibraryItem {
  id: string;
  label: string;
  slide: SlideContent;
}

export const LIBRARY: LibraryItem[] = [
  {
    id: "cover",
    label: "Cover",
    slide: { layout: "cover", title: "Cover\nHeadline", date: deckDate(), accent: "teal" },
  },
  {
    id: "chapter",
    label: "Chapter divider",
    slide: { layout: "chapter", kicker: "01", title: "The opportunity", accent: "teal" },
  },
  {
    id: "title",
    label: "Section title",
    slide: { layout: "title", title: "Section title", subtitle: "A one-line setup for what follows." },
  },
  {
    id: "statement-tribe",
    label: "Statement — Tribe",
    slide: {
      layout: "statement",
      title: "Most AI pilots stall on people and process — not the model.",
      body: "We embed senior practitioners to get models into production and prove business impact.",
      accent: "teal",
    },
  },
  {
    id: "statement-blank",
    label: "Statement",
    slide: { layout: "statement", title: "A single, strong idea goes here.", accent: "brown" },
  },
  {
    id: "bullets-tribe",
    label: "How we work — Tribe",
    slide: {
      layout: "bullets",
      title: "How we work",
      bullets: [
        "Senior practitioners embedded in your team",
        "Ship to production fast, not slideware",
        "Measure real business impact",
      ],
      accent: "teal",
    },
  },
  {
    id: "bullets-2col",
    label: "Bullets — 2 columns",
    slide: {
      layout: "bullets",
      title: "What you get",
      columns: 2,
      bullets: ["Point one", "Point two", "Point three", "Point four"],
      accent: "orange",
    },
  },
  {
    id: "grid-offerings",
    label: "What we bring — Tribe",
    slide: {
      layout: "grid",
      title: "What we bring",
      columns: 3,
      items: [
        { title: "Senior talent", body: "Vetted ML, data, and product practitioners." },
        { title: "Production focus", body: "From prototype to deployed and monitored." },
        { title: "Embedded delivery", body: "We work inside your team, not at arm's length." },
      ],
    },
  },
  {
    id: "grid-blank",
    label: "Card grid",
    slide: {
      layout: "grid",
      title: "Heading",
      columns: 3,
      items: [
        { title: "Card one", body: "Short supporting line." },
        { title: "Card two", body: "Short supporting line." },
        { title: "Card three", body: "Short supporting line." },
      ],
    },
  },
  {
    id: "stats",
    label: "Impact stats",
    slide: {
      layout: "stats",
      title: "The impact",
      items: [
        { title: "3×", body: "Faster path to production" },
        { title: "40%", body: "Lower delivery cost" },
        { title: "2 wks", body: "From kickoff to working model" },
      ],
    },
  },
  {
    id: "timeline",
    label: "Engagement timeline",
    slide: {
      layout: "timeline",
      title: "How an engagement runs",
      items: [
        { label: "Week 1", title: "Discovery", body: "Align on the goal and success metrics." },
        { label: "Weeks 2–6", title: "Build", body: "Embedded team ships to production." },
        { label: "Week 7+", title: "Scale", body: "Hand off, monitor, and expand." },
      ],
    },
  },
  {
    id: "contentImage",
    label: "Content + image",
    slide: {
      layout: "contentImage",
      title: "Heading",
      body: "A short paragraph explaining the point, with an image alongside.",
      imagePosition: "right",
    },
  },
  {
    id: "imageFull",
    label: "Full-screen image",
    slide: { layout: "imageFull", title: "Full-bleed headline", subtitle: "Add an image to set the tone." },
  },
  {
    id: "twoColumnDetail",
    label: "Two-column detail",
    slide: {
      layout: "twoColumnDetail",
      title: "Headline",
      items: [
        { title: "Map", body: "Understand the landscape — data, systems, and where AI moves the needle." },
        { title: "Build", body: "Ship production software, not slideware, with senior practitioners embedded." },
        { title: "Enable", body: "Leave your team able to run and extend what we built." },
        { title: "Compound", body: "Each engagement makes the next one faster and cheaper." },
      ],
    },
  },
  {
    id: "feature",
    label: "Feature + image",
    slide: {
      layout: "feature",
      title: "AI that ships,\nscales, and compounds.",
      body: "Not a practice we bolted on, but the only thing we've done since 2019 — across every major industry.",
      imageAspect: "portrait",
      items: [{ title: "Map. Build. Enable", body: "We write code, ship product, and obsess over solving hard problems." }],
    },
  },
  {
    id: "industry",
    label: "Industry overview",
    slide: {
      layout: "industry",
      title: "Financial Services & Insurance",
      subtitle: "Transform risk, operations, and growth with AI.",
      items: [
        { body: "Banks, insurers, and investment firms sit on massive data but rely on manual workflows and slow decisions." },
        { body: "Tribe helps them deploy AI that improves underwriting, automates operations, reduces fraud, and unlocks insight." },
      ],
    },
  },
  {
    id: "quote",
    label: "Client quote",
    slide: {
      layout: "quote",
      quote: "Tribe didn't just deliver a model — they left our team able to run it.",
      attribution: "— Name, Title, Company",
      accent: "teal",
    },
  },
  {
    id: "agenda",
    label: "Agenda",
    slide: {
      layout: "agenda",
      title: "Agenda",
      items: [
        { title: "Where we are\n& why it matters", body: "Cutting through the market noise" },
        { title: "Second-order effects", body: "What this means for a services business built on expertise" },
        { title: "Big bold bets", body: "How companies like yours are disrupting themselves" },
        { title: "How to win", body: "In an AI world" },
      ],
    },
  },
  {
    id: "logoWall",
    label: "Logo wall",
    slide: {
      layout: "logoWall",
      title: "Trusted by teams building with AI",
      logos: [],
    },
  },
  {
    id: "textColumns",
    label: "Text columns",
    slide: {
      layout: "textColumns",
      title: "What this means",
      columns: 3,
      bullets: [
        "A short paragraph making the first point in plain language.",
        "A second paragraph, roughly the same length, sitting alongside.",
        "A third that rounds out the idea without a bullet in sight.",
      ],
    },
  },
  {
    id: "chart",
    label: "Bar chart",
    slide: {
      layout: "chart",
      title: "Time to production, by engagement",
      items: [
        { label: "Q1", title: "12" },
        { label: "Q2", title: "40", highlight: true },
        { label: "Q3", title: "27" },
        { label: "Q4", title: "41" },
      ],
      body: "Source: Analytics",
    },
  },
];
