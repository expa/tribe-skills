# Tribe AI — Design Skills

A set of **agent skills** that teach an AI assistant (Claude Code, Claude
Desktop, or any tool that supports the [Agent Skills](https://docs.claude.com)
format) how to make things that look and read unmistakably like Tribe — websites,
social graphics, slides, and documents.

## The skills

| Skill | What it does |
|---|---|
| **tribe-brand** | The visual identity — color tokens, typography roles, logo usage, motion, do's & don'ts. The foundation every other skill references. |
| **tribe-web-pages** | Building pages on the Tribe website (Next.js + Payload): page skeleton, the component library, CMS-driven copy rules, the migrations workflow. |
| **tribe-visuals** | On-brand marketing & social graphics (LinkedIn / X / OG / quote cards) as self-contained HTML/SVG at correct export dimensions. |
| **tribe-slides** | On-brand 16:9 presentation decks as self-contained, keyboard-navigable, print-to-PDF HTML. |
| **tribe-documents** | On-brand long-form documents (proposals, one-pagers, reports) as self-contained, print-ready HTML. |

Each skill is a folder with a `SKILL.md` (YAML frontmatter + instructions) and,
where useful, an `assets/` folder with copy-paste tokens and working templates.

## Install

```bash
npx skills add tribeai/tribe-skills
```

That installs all five skills. To install just one, point your tool at a single
folder (e.g. `tribe-slides/`) — each skill is self-contained:
`tribe-visuals`, `tribe-slides`, and `tribe-documents` carry their own tokens
and templates and only *reference* `tribe-brand` for the full system, so they
work standalone too.

You can also copy the folders straight into your personal skills directory:

```bash
git clone https://github.com/tribeai/tribe-skills
cp -r tribe-skills/tribe-* ~/.claude/skills/
```

### Claude apps (claude.ai & Claude Desktop)

The Claude apps load Skills as uploaded folders — no command line needed:

1. **Download the repo.** On the [repo page](https://github.com/tribeai/tribe-skills),
   click the green **Code** button → **Download ZIP**, then unzip it. Each
   `tribe-*` folder inside is one skill.
2. **Zip each skill on its own.** A skill uploads as a single folder, so
   compress the folders individually (not the whole download): right-click a
   `tribe-*` folder → **Compress** (macOS) or **Send to → Compressed (zipped)
   folder** (Windows). You'll get `tribe-brand.zip`, `tribe-visuals.zip`, etc.
3. **Upload in the app.** Go to **Settings → Capabilities → Skills → Upload
   skill** (the Skills capability must be enabled for your workspace) and upload
   `tribe-brand.zip` first — the others reference it — then the rest.

Once uploaded, Claude auto-selects the right skill from what you ask, same as in
Claude Code. To update a skill after a change, re-download and re-upload its zip.

## How & when to use

You don't invoke skills directly — the assistant **auto-selects** them from your
request, based on each skill's `description`. Just ask in plain language:

- *"Make a LinkedIn banner announcing our new case study"* → `tribe-visuals`
- *"Turn this into an on-brand pitch deck"* → `tribe-slides`
- *"Draft a one-pager proposal for Acme"* → `tribe-documents`
- *"Add an industries section to the site"* → `tribe-web-pages` (+ `tribe-brand`)
- *"Is this on-brand?"* / *"What are our brand colors?"* → `tribe-brand`

For visuals/slides/documents the output is a self-contained HTML file you can
open, screenshot, or print to PDF. For pixel-exact type, drop copies of the real
fonts (from the website's `/public/fonts`) next to the file and uncomment the
`@font-face` block in the template.

## Keeping in sync

The brand tokens are the source of truth in the Tribe website repo and are
mirrored here. They appear in **three places that must stay in sync**:
`lib/colors.tsx` (canvas hex, source of truth) and the `@theme` in
`app/globals.css` (CSS vars) in the website, and `tribe-brand/assets/tribe-tokens.css`
here (for standalone artifacts). Change one → change all three, and update
`tribe-brand/SKILL.md` and the website's `DESIGN.md` if a role or rule changes.
