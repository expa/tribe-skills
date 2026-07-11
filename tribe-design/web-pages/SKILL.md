# Tribe Design — Web Pages

For building pages in the Tribe website repo. **Read `../brand/SKILL.md` first** for
the visual system; this skill is the *implementation* layer. Also read the
repo's `AGENTS.md` and `DESIGN.md` — they are normative.

> ⚠️ This is **not stock Next.js** — the repo pins a version with breaking
> changes. Read the relevant guide in `node_modules/next/dist/docs/` before
> writing routing/data code, and match an existing `app/(main)/*` page rather
> than inventing.

## Where things live

- `app/(main)/*` — public pages. Persistent chrome (header, nav, footer, Tusi
  figure) lives in `app/(main)/layout.tsx`, so a page renders **only its own
  sections** — no `<header>`/`<footer>` of its own.
- `collections/*.ts` — Payload collections + globals (`Homepage`, `Nav`,
  `Footer`, `Articles`, `CaseStudies`, `Industries`…). Source of all copy.
- `app/components/*` — shared React components.
- `lib/colors.tsx` — canvas/JS color source of truth.
- `migrations/*` — generated SQL migrations.

**Many variants exist.** Numbered/suffixed routes (`articles-2…11`,
`careers-v2`, `industries-v2`, `case-studies/preview-*`) are experiments. The
**live** page is almost always the **unsuffixed** route. Confirm which route is
actually linked (via `Nav` in the CMS / `layout.tsx`) before editing — don't
polish a dead variant.

## Content is CMS-driven — never hardcode copy

All editorial copy (product names, taglines, labels, body) comes from Payload,
**not source.**

- Need new copy? **Add a field to the relevant global/collection and read it** —
  don't hardcode the string. (Schema change → migration; see below.)
- **No placeholder fallbacks.** If a CMS field is empty, render nothing
  (`{title && <h2>…</h2>}`) — never invent stand-in text.
- Static non-CMS microcopy (legal text, `© {year}`, fixed section labels) may
  stay in code.

## Page skeleton

```
Hero (eyebrow → title → body → action)
  → alternating content sections (background-primary / background-secondary)
  → pre-footer CTA (dark)
  → footer  (footer is in the layout — don't add one)
```

- **Container** — `container mx-auto px-10`. Horizontal padding is always
  `px-10` at the container; never nest a second padded container inside it.
- **Section rhythm** — vertical padding `py-28` (standard), `py-32`/`py-40`
  (hero-ish). Header→content gap `gap-16`.
- **Hero clearance** — first section `pt-[160px]` so it clears the fixed header.
- **Section header block** — `flex flex-col gap-4 max-w-2xl`.
- Keep section anchors (`#what-we-do`, `#model`, `#pre-footer`…) even when inner
  content is conditional — scroll triggers depend on them.
- Use Tailwind tokens (`text-foreground-primary`, `bg-background-secondary`,
  `text-accent-orange`), not raw hex. Raw hex (`colors.accentTeal`) only in
  canvas/JS where CSS vars can't reach.

## The header MUST animate in — the whole block

A header is eyebrow + title + subtitle, and **all three animate** (matching the
`/careers` and `/industries` heroes). Never ship a static header element.

```tsx
<header className="flex flex-col gap-4 max-w-2xl">
  <FadeInSerif as="p" introOnMount inOrder
    className="font-caption text-xs uppercase tracking-wider text-foreground-primary">
    {eyebrow}
  </FadeInSerif>
  <FadeInSerif as="h1" introOnMount
    className="font-serif font-light text-4xl md:text-6xl leading-[1.1] text-balance text-foreground-primary">
    {title}
  </FadeInSerif>
  <FadeInBody as="p" introOnMount delay={0.2}
    className="font-sans font-light leading-relaxed text-lg text-foreground-primary/70 text-pretty">
    {body}
  </FadeInBody>
  {/* any header action/button */}
  <FadeInBody introOnMount delay={0.3}>
    <CTAButton variant="dark" href={ctaHref}>{ctaLabel}</CTAButton>
  </FadeInBody>
</header>
```

Lighter blocks/cards below the header may use the `rise-in` class (optionally
with a staggered `animationDelay`) or the `<RiseIn>` component. Everything
degrades to a plain fade under `prefers-reduced-motion`.

## Component library

- **`CTAButton`** — primary action. `variant`: `dark` (solid ink pill on light),
  `light` (on dark surfaces), `outline` / `outlineDark` (bordered). `href` makes
  it an `<a>`; `iconOnly` renders the dot-grid square. Carries a dot-grid
  trailing icon that reveals on hover. Primary → solid, secondary → outline.
- **`ScrollCTAButton`** — for in-page anchors; smooth-scrolls via Lenis, falls
  back to normal navigation off-page.
- **`FadeInSerif`** — per-character serif reveal. Props: `as`, `introOnMount`
  (fire on mount vs on scroll-into-view), `inOrder` (reading order vs scramble),
  `byRow`, `delay`/`introDelay`, `colorFlash` (brand-cyan flash, on by default),
  `scrub`. Use for eyebrows and headings.
- **`FadeInBody`** — same idea, tuned for body text. Props: `as`, `introOnMount`,
  `delay`, `inOrder`, `colorFlash` (off by default). Use for subtitles/body.
- **`RiseIn`** / `.rise-in` class — blocks rise + fade on scroll; stagger with
  `delay` / `animationDelay`.
- **Cards** — light card `rounded-lg bg-background-secondary p-8`; dark/feature
  card `rounded-lg bg-foreground-primary text-background-primary`, riding a
  `-z-10` layer that scales on hover instead of a heavier shadow.
- **Inline links** — `text-brand underline underline-offset-4`.
- **Logos** (`BrandLogo`, `WordmarkLogo`) link home / scroll-to-top — don't
  repurpose.

Motion uses house easing `cubic-bezier(0.625,0.05,0,1)`. Lenis drives smooth
scroll (`window.__lenis`; programmatic scrolls use `lenis.scrollTo` with a
~`-120`/`-140` header offset).

## Database schema changes: Payload migrations ONLY

Everyone's local dev points at the **same remote Neon DB**, so Payload dev push
is disabled. Schema changes go through migrations:

1. Edit the collection/global configs (`collections/*.ts`).
2. `npm run migrate:create -- <snake_case_name>` → writes
   `migrations/<timestamp>_<name>.ts` + `.json`.
3. **Review the generated SQL** — especially any `DROP`/`ALTER … DROP COLUMN`.
   If it drops something your diff doesn't explain, a teammate's unmerged schema
   is in the DB: **stop and coordinate** instead of committing the drop.
4. Commit the migration files *together with* the config change.
5. Apply: `npm run migrate` (deploys run this automatically).

Migration data is content: when a field moves, the migration should move the
data too. A schema-affecting PR without a migration file is incomplete. NEVER
hand-write SQL against the DB or re-enable dev push against the shared DB.

## Media files: ALWAYS upload to Blob

Production serves media from Vercel Blob — a `media` row whose file was never
uploaded renders a broken image. Any script creating a media row MUST write
bytes through `saveMediaFile()` (`scripts/lib/blob-media.mjs`). After a content
import, verify with `npm run check:media` (`-- --fix` re-uploads).

## Verify

- `npm run lint` — ESLint. No `typecheck` script; run `npx tsc --noEmit`.
- `npm run dev` — talks to the **shared remote Neon DB**; treat content writes
  as production data.
- `npm run build` runs `payload migrate && next build`.

The whole site is hidden from search/AI until launch via one flag — `INDEXABLE`
in `lib/site.ts`. **Do not flip it without explicit launch sign-off.** Internal
tools live under `app/handbook/` (and `app/generate/`) and stay `noindex`
regardless.
