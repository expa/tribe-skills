# tribe-design

One **Agent Skill** that teaches an AI assistant everything about making Tribe
things — the brand, the writing voice, and a set of **runnable generators**
that export finished, on-brand assets: social cards, charts, cover art, the
Tusi animation, slide decks, system diagrams, and documents.

Works with Claude Code, Claude Desktop, claude.ai, and any tool that supports
the [Agent Skills](https://docs.claude.com) format. Lives in this repo at
[`tribe-design/`](tribe-design/).

## What it can make

| Ask for | It uses | You get |
|---|---|---|
| A quote, stat, or announcement graphic | `social-card` | PNG · 1:1, 4:5, 9:16 |
| A chart from your numbers | `data-card` | PNG · 1:1, 16:9, 4:5 |
| Abstract cover / background art | `article-cover` | PNG, SVG, animated WEBM |
| The Tusi orbital figure (hero art, video background) | `animation` | transparent PNG, WEBM |
| A pitch deck, case study, proposal deck | `deck-builder` | browser preview + vector PDF |
| A system diagram or flowchart | `diagram` | SVG, PNG |
| A proposal, one-pager, report | `documents` | doc data JSON → site generator → A4 PDF |
| Copy that sounds like Tribe | `voice` | website & article registers |
| Brand rules, tokens, fonts, logos | `brand` | the source of truth, bundled |
| Pages on tribe.ai | `web-pages` | code (needs the website repo) |

And it **composes**: a Tusi still becomes a slide background, a chart drops
into a proposal, a diagram lands in a deck. The assistant routes between
sub-skills on its own — you just describe the outcome.

Everything is self-contained: real brand fonts, every logo variant, ported
generator code, and verified example renders ship inside the skill. The only
thing that needs the website repo is `web-pages` (it *is* website work).

## Install

### Claude Code (terminal)

```bash
git clone https://github.com/expa/tribe-skills
cp -r tribe-skills/tribe-design ~/.claude/skills/        # all projects
# or: cp -r tribe-skills/tribe-design <project>/.claude/skills/   # one project
```

One-time setup for image/video/PDF exports (installs `playwright-core`; uses
the Chrome you already have):

```bash
cd ~/.claude/skills/tribe-design/scripts && npm install
```

That's it. In any session, just ask: *"make a quote card from this line"*,
*"turn these notes into a pitch deck"*, *"diagram our RAG pipeline"* — Claude
finds the skill, generates the asset, and exports the file.

### Claude Desktop & claude.ai (no terminal)

1. **Download**: on this repo's page, **Code → Download ZIP**, unzip.
2. **Zip the skill folder**: right-click the `tribe-design` folder →
   **Compress** (macOS) / **Send to → Compressed folder** (Windows).
3. **Upload**: in Claude, **Settings → Capabilities → Skills → Upload skill**,
   pick `tribe-design.zip`. (The Skills capability must be enabled for your
   workspace.)

Then just ask, same as above. One difference: the Claude apps can't run the
headless export scripts, so Claude hands you the artifact to finish in your
browser — e.g. a deck preview you open and print to PDF (Cmd+P), or a
self-contained HTML card you screenshot. Decks are zero-friction: Claude
gives you a link/file, arrow keys present it, printing exports it.

To update after a new release: re-download and re-upload the zip.

## How it's organized

```
tribe-design/
├── SKILL.md            the router — brand summary, routing, composition recipes
├── scripts/render.mjs  shared headless exporter (PNG / PDF / WEBM)
├── brand/              tokens, real fonts, all logo variants, the rules
├── voice/              how Tribe writes, distilled from published work
├── animation/          Tusi figure generator
├── social-card/        quote / statement / stat / partner cards
├── data-card/          bar & line chart cards
├── article-cover/      generative node artwork
├── deck-builder/       deck JSON → standalone renderer → vector PDF
├── diagram/            diagram JSON → auto-layout → branded SVG/PNG
├── documents/          doc data JSON → site doc generator → editable A4 PDF
└── web-pages/          guide for building pages in the website repo
```

Each sub-skill: a `GUIDE.md` the assistant reads on demand, `tool/` (runnable
generator, original website sources kept in `tool/reference/`), `assets/`
(templates), `examples/` (verified renders it compares its output against).

## Keeping in sync

The [website repo](https://github.com/TribeAI/tribe) is the source of
truth; this skill mirrors it. When something changes there, update here:

- **Tokens** — `app/globals.css` `@theme` → `tribe-design/brand/assets/tribe-tokens.css`
- **Fonts / logos** — `public/fonts`, `public/brand` → `tribe-design/brand/assets/`
- **Generators** — `app/handbook/*` + `lib/*` → each sub-skill's `tool/`
  (diff against `tool/reference/`)
- **Voice** — re-distill from published articles when the body of writing
  meaningfully grows

House rules worth repeating: eyebrows are **ink, never orange**; the serif is
never bold; one accent per artifact; warm paper, never pure white.
