import { BRAND } from "./brand";

// Global deck settings — apply to every slide unless a slide overrides
// visibility (see SlideContent.hide). Chrome text defaults to the brand values
// in lib/brand.ts but is editable here so sales can tailor a deck.
export type SlideBackground =
  | "paper" | "soft" | "white" | "sand" | "dark"
  | "cyan" | "teal" | "ocean" | "orange" | "yellow" | "brown";

// Slide surfaces: neutral papers + the brand palette that animates in the
// cover figure (lib/colors.tsx / TusiAnimation DOT_COLORS). `fg` overrides the
// foreground ink for legibility on darker colors (unset → default dark ink).
export const SLIDE_BACKGROUNDS: { id: SlideBackground; label: string; hex: string; fg?: string }[] = [
  { id: "paper", label: "Paper", hex: "#FAFAF8" },
  { id: "soft", label: "Soft", hex: "#F4F4F2" },
  { id: "white", label: "White", hex: "#FFFFFF" },
  { id: "sand", label: "Sand", hex: "#EBEBE2" },
  { id: "dark", label: "Ink", hex: "#06141B", fg: "#FAFAF8" },
  { id: "cyan", label: "Cyan", hex: "#65D9EE" },
  { id: "teal", label: "Teal", hex: "#0A99C3", fg: "#FAFAF8" },
  { id: "ocean", label: "Ocean", hex: "#0D4E6E", fg: "#FAFAF8" },
  { id: "orange", label: "Orange", hex: "#FF7C0F" },
  { id: "yellow", label: "Yellow", hex: "#FEDE59" },
  { id: "brown", label: "Brown", hex: "#AD5913", fg: "#FAFAF8" },
];

export interface DeckConfig {
  name: string;               // editable deck name (shown top of panel, used for share/export)
  background: SlideBackground; // surface for all (non-cover) slides
  eyebrow: string;            // top-left kicker
  deckTitle: string;          // running title, top-right
  footer: string;             // bottom-left footer
  showFooterLine: boolean;    // the bottom hairline rule, independent of the footer text
  showPageNumbers: boolean;   // bottom-right NN / NN
  showLogo: boolean;          // Tribe symbol mark, top-right
}

export const DEFAULT_DECK: DeckConfig = {
  name: "Untitled deck",
  background: "paper",
  eyebrow: BRAND.eyebrow,
  deckTitle: "",
  footer: BRAND.footer,
  showFooterLine: true,
  showPageNumbers: BRAND.showPageNumbers,
  showLogo: false,
};
