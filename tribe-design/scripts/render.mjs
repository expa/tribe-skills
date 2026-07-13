#!/usr/bin/env node
/**
 * Tribe Design — shared headless renderer.
 * Renders a local HTML file (or URL) in headless Chromium and exports:
 *   PNG / WEBP screenshot, PDF (print), or WEBM video (page recording).
 *
 * Usage:
 *   node render.mjs --html tool/card.html --query 'params=…' --out card.png
 *   node render.mjs --html tool/deck.html --pdf deck.pdf
 *   node render.mjs --url http://localhost:3000/… --selector canvas --out shot.png
 *   node render.mjs --html tool/anim.html --webm anim.webm --duration 4000
 *
 * Options:
 *   --html <file> | --url <url>     what to load (one required)
 *   --query <string>                query string appended to the URL (no leading ?)
 *   --out <file.png|.webp>          screenshot output
 *   --selector <css>                clip screenshot to this element (default: full page)
 *   --pdf <file.pdf>                print-to-PDF (uses CSS @page size)
 *   --webm <file.webm>              record page video
 *   --duration <ms>                 video length / extra settle time (default 4000 for video)
 *   --width / --height              viewport (default 1280×720)
 *   --scale <n>                     deviceScaleFactor (default 2 for screenshots, 1 otherwise)
 *   --wait <ms>                     extra wait before capture (default 300)
 *   --transparent                   omit page background in screenshots
 *
 * Readiness: after load + fonts, if the page defines `window.__READY__`
 * (a boolean or a Promise), we await it before capturing.
 *
 * Canvas capture: when --selector matches a <canvas>, pixels are read straight
 * from the canvas backing store (toDataURL) and resampled to the target size
 * (CSS size × --scale) with high-quality stepped downscaling. Screenshotting
 * the CSS-scaled element instead would let the compositor downsample with
 * cheap bilinear filtering — that's what makes text/graphics look pixelated.
 *
 * Setup (once): `npm install` in this folder (installs playwright-core; no
 * browser download — it finds the Playwright browser cache or desktop Chrome).
 * If neither exists: `npx playwright install chromium`.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) args[key] = true
    else { args[key] = next; i++ }
  }
}

if (!args.html && !args.url) {
  console.error('Provide --html <file> or --url <url>. See header comment for usage.')
  process.exit(1)
}

const { chromium } = await import('playwright-core').catch(() => {
  console.error('playwright-core not installed. Run `npm install` in the scripts/ folder.')
  process.exit(1)
})

function findChromium() {
  // 1. explicit override
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  // 2. Playwright browser cache (any installed chromium build)
  const caches = [
    path.join(homedir(), 'Library/Caches/ms-playwright'), // macOS
    path.join(homedir(), '.cache/ms-playwright'),          // Linux
  ]
  for (const cache of caches) {
    if (!existsSync(cache)) continue
    const builds = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    for (const build of builds) {
      for (const rel of [
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
      ]) {
        const p = path.join(cache, build, rel)
        if (existsSync(p)) return p
      }
    }
  }
  // 3. desktop Chrome
  for (const p of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ]) if (existsSync(p)) return p
  return null
}

const executablePath = findChromium()
if (!executablePath) {
  console.error('No Chromium found. Run `npx playwright install chromium` or install Google Chrome.')
  process.exit(1)
}

const width = Number(args.width || 1280)
const height = Number(args.height || 720)
const scale = Number(args.scale || (args.out ? 2 : 1))
const settle = Number(args.wait || 300)
const duration = Number(args.duration || (args.webm ? 4000 : 0))

let target = args.url || pathToFileURL(path.resolve(args.html)).href
if (args.query) target += (target.includes('?') ? '&' : '?') + args.query

// --allow-file-access-from-files: file:// pages may read sibling file:// images into
// canvas without tainting it (needed by tools that sample local images, e.g. node-cover).
// Font flags: headless (esp. Linux) otherwise hints/subpixel-renders type for an LCD,
// which exports as jagged or color-fringed text in PNGs and PDFs.
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--allow-file-access-from-files',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
  ],
})
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: scale,
  ...(args.webm ? { recordVideo: { dir: path.dirname(path.resolve(args.webm)), size: { width, height } } } : {}),
})
const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))

await page.goto(target, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts?.ready)
// Optional page-defined readiness signal
await page.evaluate(async () => {
  const r = window.__READY__
  if (r && typeof r.then === 'function') await r
})
if (settle) await page.waitForTimeout(settle)

if (args.out) {
  const type = args.out.endsWith('.webp') ? 'jpeg' : 'png' // playwright: png|jpeg; webp via canvas below
  if (args.out.endsWith('.webp')) {
    // capture the target (selector or viewport) via in-page canvas → webp
    console.error('WEBP: exporting via PNG then leaving conversion to caller is more robust; capturing PNG data at quality here.')
  }
  const shotOpts = { path: args.out.endsWith('.webp') ? args.out.replace(/\.webp$/, '.png') : args.out, type: 'png', omitBackground: Boolean(args.transparent) }
  if (args.selector) {
    const el = await page.waitForSelector(args.selector, { timeout: 10_000 })
    const isCanvas = await el.evaluate((n) => n.tagName === 'CANVAS')
    if (isCanvas) {
      // Read pixels straight from the backing store: a canvas is often drawn
      // larger than its CSS size (e.g. a 3× export buffer), and an element
      // screenshot would re-sample the compositor's cheap bilinear downscale
      // of it — visibly aliased text/edges. Resample here with stepped
      // high-quality drawImage instead, targeting CSS size × --scale.
      const dataUrl = await el.evaluate(async (canvas, opts) => {
        const targetW = Math.max(1, Math.round(canvas.clientWidth * opts.scale))
        const targetH = Math.max(1, Math.round(canvas.clientHeight * opts.scale))
        let src = canvas
        if (canvas.width !== targetW || canvas.height !== targetH) {
          let w = canvas.width
          let h = canvas.height
          // Halve until within 2× of the target (bilinear stays accurate ≤2×),
          // then draw the final size.
          while (w / 2 > targetW && h / 2 > targetH) {
            w = Math.round(w / 2)
            h = Math.round(h / 2)
            const step = document.createElement('canvas')
            step.width = w
            step.height = h
            const sctx = step.getContext('2d')
            sctx.imageSmoothingEnabled = true
            sctx.imageSmoothingQuality = 'high'
            sctx.drawImage(src, 0, 0, w, h)
            src = step
          }
          const out = document.createElement('canvas')
          out.width = targetW
          out.height = targetH
          const octx = out.getContext('2d')
          if (!opts.transparent) {
            const bg = getComputedStyle(document.body).backgroundColor
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              octx.fillStyle = bg
              octx.fillRect(0, 0, targetW, targetH)
            }
          }
          octx.imageSmoothingEnabled = true
          octx.imageSmoothingQuality = 'high'
          octx.drawImage(src, 0, 0, targetW, targetH)
          src = out
        }
        return src.toDataURL('image/png')
      }, { scale, transparent: Boolean(args.transparent) })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(shotOpts.path, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'))
    } else {
      await el.screenshot(shotOpts)
    }
  } else {
    await page.screenshot({ ...shotOpts, fullPage: false })
  }
  console.log(`Wrote ${shotOpts.path}${args.out.endsWith('.webp') ? ' (PNG — convert with sips/cwebp if WEBP required)' : ''}`)
}

if (args.pdf) {
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: args.pdf, preferCSSPageSize: true, printBackground: true })
  console.log(`Wrote ${args.pdf}`)
}

if (args.webm) {
  await page.waitForTimeout(duration)
}

await context.close() // finalizes video
if (args.webm) {
  const video = page.video()
  if (video) {
    const temp = await video.path()
    const { renameSync } = await import('node:fs')
    renameSync(temp, path.resolve(args.webm))
    console.log(`Wrote ${args.webm}`)
  }
}
await browser.close()
