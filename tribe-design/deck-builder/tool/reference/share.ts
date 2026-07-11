import type { DeckConfig } from "./deck-config";
import type { SlideContent } from "./slides";

// Encode a deck into a URL-safe string for the /view#… share link. Uploaded
// images are data URLs (too large for a URL), so they're dropped — shared links
// carry text + layout, not embedded images.
export interface DeckPayload {
  deck: DeckConfig;
  slides: SlideContent[];
}

const stripImages = (slides: SlideContent[]): SlideContent[] =>
  slides.map((s) => {
    const logos = s.logos?.filter((l) => !l.startsWith("data:"));
    return {
      ...s,
      imageUrl: s.imageUrl?.startsWith("data:") ? undefined : s.imageUrl,
      partnerLogoUrl: s.partnerLogoUrl?.startsWith("data:") ? undefined : s.partnerLogoUrl,
      logos: logos?.length ? logos : undefined,
    };
  });

// Unicode-safe base64.
const b64encode = (str: string) => btoa(unescape(encodeURIComponent(str)));
const b64decode = (str: string) => decodeURIComponent(escape(atob(str)));

export function encodeDeck(deck: DeckConfig, slides: SlideContent[]): string {
  return b64encode(JSON.stringify({ deck, slides: stripImages(slides) }));
}

export function decodeDeck(encoded: string): DeckPayload | null {
  try {
    const parsed = JSON.parse(b64decode(encoded)) as DeckPayload;
    if (!Array.isArray(parsed.slides) || !parsed.deck) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deckHasImages(slides: SlideContent[]): boolean {
  return slides.some(
    (s) =>
      s.imageUrl?.startsWith("data:") ||
      s.partnerLogoUrl?.startsWith("data:") ||
      s.logos?.some((l) => l.startsWith("data:")),
  );
}
