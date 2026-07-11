#!/usr/bin/env node
/**
 * Tribe deck-builder — deck.json → PDF, via the site's /handbook/deck-builder/view route.
 *
 * REQUIRES the Tribe website dev server: run `npm run dev` in the website repo
 * (default http://localhost:3000) before invoking this. Do NOT start the dev
 * server yourself unless asked — it talks to the shared production database.
 *
 * Usage:
 *   node export-deck.mjs <deck.json> <out.pdf> [options]
 * Options:
 *   --base <url>        website origin (default http://localhost:3000)
 *   --wait <ms>         settle time after first load (default 2500 — /view decodes
 *                       the hash client-side and fonts/figures need a beat)
 *   --slide-wait <ms>   settle time after each slide advance (default 700)
 *   --scale <n>         screenshot deviceScaleFactor (default 2 → crisp 2560×1440 pages)
 *
 * How it works (and why it isn't a plain `render.mjs --pdf --url <view-url>`):
 * the /view route mounts DeckViewer — ONE slide at a time with keyboard nav —
 * and does NOT mount PrintDeck or the deck-builder.css `@page 1280px 720px`
 * print rules (those live only on the editor route, which can't read a hash).
 * Printing /view directly therefore yields a single default-size page. So this
 * script drives the viewer instead:
 *   1. encode deck.json → open <base>/handbook/deck-builder/view#<hash>
 *      at exactly 1280×720 (the slide fills the viewport edge-to-edge);
 *   2. screenshot each slide, pressing ArrowRight between shots;
 *   3. compose the shots into a print HTML (@page 1280px 720px) and print it
 *      to PDF in the same headless Chromium — one slide per page.
 * The PDF pages are high-res raster (default 2×), not selectable text.
 *
 * Setup: `npm install` once in ../../scripts (playwright-core + a Chromium).
 */
import { writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { loadDeckFile, encodeDeck, viewUrl } from "./encode-deck.mjs";

// ---------------------------------------------------------------- args
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
const [deckFile, outPdf] = positional;
if (!deckFile || !outPdf) {
  console.error("Usage: node export-deck.mjs <deck.json> <out.pdf> [--base http://localhost:3000] [--wait 2500] [--slide-wait 700] [--scale 2]");
  process.exit(1);
}
const base = String(flags.base ?? "http://localhost:3000");
const settle = Number(flags.wait ?? 2500);
const slideSettle = Number(flags["slide-wait"] ?? 700);
const scale = Number(flags.scale ?? 2);

// ---------------------------------------------------------------- encode
const { deck, slides } = loadDeckFile(deckFile);
const url = viewUrl(base, encodeDeck(deck, slides));
console.log(`Deck: ${deck.name} — ${slides.length} slide${slides.length === 1 ? "" : "s"}`);

// ---------------------------------------------------------------- server check
try {
  await fetch(base, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(`No server at ${base}. Start the Tribe website first: \`npm run dev\` in the website repo.`);
  console.error("(Do not start it unattended — local dev talks to the shared production database.)");
  process.exit(1);
}

// ---------------------------------------------------------------- browser
// playwright-core lives in ../../scripts/node_modules — resolve from there.
const require = createRequire(new URL("../../scripts/package.json", import.meta.url));
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("playwright-core not installed. Run `npm install` in tribe-design/scripts/.");
  process.exit(1);
}

// Same Chromium discovery as scripts/render.mjs.
function findChromium() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const caches = [
    path.join(homedir(), "Library/Caches/ms-playwright"),
    path.join(homedir(), ".cache/ms-playwright"),
  ];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    const builds = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const build of builds) {
      for (const rel of [
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
      ]) {
        const p = path.join(cache, build, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ]) if (existsSync(p)) return p;
  return null;
}
const executablePath = findChromium();
if (!executablePath) {
  console.error("No Chromium found. Run `npx playwright install chromium` or install Google Chrome.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
const tmp = mkdtempSync(path.join(tmpdir(), "tribe-deck-"));
try {
  // -------------------------------------------------------------- pass 1: shots
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(settle);

  if (await page.getByText("Nothing to show").count()) {
    throw new Error("/view rendered 'Nothing to show' — the hash didn't decode. Check the deck JSON.");
  }
  // Hide the viewer's own chrome (page indicator + invisible nav click zones).
  await page.addStyleTag({
    content: `p.bottom-6, button[aria-label="Previous"], button[aria-label="Next"] { display: none !important; }`,
  });

  const shots = [];
  for (let i = 0; i < slides.length; i++) {
    const shot = path.join(tmp, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    shots.push(shot);
    if (i < slides.length - 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(slideSettle);
    }
  }
  await context.close();

  // -------------------------------------------------------------- pass 2: PDF
  const html = `<!doctype html><meta charset="utf-8"><style>
    @page { size: 1280px 720px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: 1280px; height: 720px; break-after: page; page-break-after: always; }
    img:last-child { break-after: auto; page-break-after: auto; }
  </style>${shots.map((s) => `<img src="${pathToFileURL(s).href}">`).join("")}`;
  const htmlFile = path.join(tmp, "deck-print.html");
  writeFileSync(htmlFile, html);

  const printPage = await browser.newPage();
  await printPage.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  await printPage.emulateMedia({ media: "print" });
  await printPage.pdf({ path: outPdf, preferCSSPageSize: true, printBackground: true });
  await printPage.close();

  console.log(`Wrote ${outPdf} (${slides.length} pages, ${1280 * scale}×${720 * scale} raster per page)`);
} finally {
  await browser.close();
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* temp cleanup best-effort */ }
}
