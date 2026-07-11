#!/usr/bin/env node
/**
 * Tribe deck-builder — deck.json ⇄ share-URL encoder.
 *
 * Faithful Node port of the site's lib/deck-builder/share.ts (encodeDeck /
 * decodeDeck): JSON → UTF-8 → base64, placed in the URL hash of the read-only
 * /handbook/deck-builder/view route. Data-URL images are stripped exactly as
 * the site does (share links carry text + layout, never embedded images).
 *
 * Usage:
 *   node encode-deck.mjs <deck.json> [--base http://localhost:3000]
 *       → prints the full view URL: <base>/handbook/deck-builder/view#<hash>
 *   node encode-deck.mjs --decode <url-or-hash>
 *       → prints the decoded { deck, slides } JSON (pretty)
 *   node encode-deck.mjs <deck.json> --hash-only
 *       → prints just the hash (no base URL)
 *
 * deck.json shape: { "deck": {…DeckConfig, all fields optional…}, "slides": [SlideContent, …] }
 * A missing/partial "deck" is filled from the site's DEFAULT_DECK.
 * See ../assets/layout-guide.md and reference/slides.ts for the slide schema.
 */
import { readFileSync } from "node:fs";

export const VIEW_PATH = "/handbook/deck-builder/view";

// Mirror of DEFAULT_DECK (lib/deck-builder/deck-config.ts + lib/deck-builder/brand.ts).
export const DEFAULT_DECK = {
  name: "Untitled deck",
  background: "paper",
  eyebrow: "Tribe AI",
  deckTitle: "",
  footer: "Tribe AI — Confidential",
  showFooterLine: true,
  showPageNumbers: true,
  showLogo: false,
};

// Mirror of share.ts stripImages: uploaded images are data URLs — too large for
// a URL — so they're dropped. Remote (http) URLs pass through untouched.
export const stripImages = (slides) =>
  slides.map((s) => {
    const logos = s.logos?.filter((l) => !l.startsWith("data:"));
    return {
      ...s,
      imageUrl: s.imageUrl?.startsWith("data:") ? undefined : s.imageUrl,
      partnerLogoUrl: s.partnerLogoUrl?.startsWith("data:") ? undefined : s.partnerLogoUrl,
      logos: logos?.length ? logos : undefined,
    };
  });

// share.ts uses btoa(unescape(encodeURIComponent(str))) — i.e. base64 over the
// UTF-8 bytes. Buffer's "utf8" ⇄ "base64" is byte-for-byte identical.
export const b64encode = (str) => Buffer.from(str, "utf8").toString("base64");
export const b64decode = (str) => Buffer.from(str, "base64").toString("utf8");

export function encodeDeck(deck, slides) {
  return b64encode(JSON.stringify({ deck, slides: stripImages(slides) }));
}

export function decodeDeck(encoded) {
  try {
    const parsed = JSON.parse(b64decode(encoded));
    if (!Array.isArray(parsed.slides) || !parsed.deck) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Load a deck.json file → a complete { deck, slides } payload (deck defaults filled).
export function loadDeckFile(file) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error(`${file}: expected { "deck": {…}, "slides": [ … ] } with at least one slide`);
  }
  for (const [i, s] of parsed.slides.entries()) {
    if (!s || typeof s.layout !== "string") throw new Error(`${file}: slides[${i}] is missing a "layout"`);
  }
  return { deck: { ...DEFAULT_DECK, ...(parsed.deck ?? {}) }, slides: parsed.slides };
}

export function viewUrl(base, hash) {
  return `${base.replace(/\/$/, "")}${VIEW_PATH}#${hash}`;
}

// ---------------------------------------------------------------- CLI
const isMain =
  process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positional.push(argv[i]);
  }

  try {
    if (flags.decode) {
      // Accept a full URL, a "#hash", or a bare hash.
      const raw = String(flags.decode === true ? positional[0] ?? "" : flags.decode);
      const hash = raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : raw;
      if (!hash) throw new Error("--decode needs a URL or hash");
      const payload = decodeDeck(hash);
      if (!payload) throw new Error("could not decode — corrupted or non-deck hash");
      console.log(JSON.stringify(payload, null, 2));
    } else {
      const file = positional[0];
      if (!file) {
        console.error("Usage: node encode-deck.mjs <deck.json> [--base http://localhost:3000] [--hash-only]");
        console.error("       node encode-deck.mjs --decode <url-or-hash>");
        process.exit(1);
      }
      const { deck, slides } = loadDeckFile(file);
      const hash = encodeDeck(deck, slides);
      console.log(flags["hash-only"] ? hash : viewUrl(String(flags.base ?? "http://localhost:3000"), hash));
    }
  } catch (err) {
    console.error(`encode-deck: ${err.message}`);
    process.exit(1);
  }
}
