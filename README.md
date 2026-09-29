# portfolio

Trevor Taylor's portfolio. Astro, Markdown content in git, and a terminal you can type into.

**Stack:** Astro (static) · TypeScript · React islands (flat terminal) · three.js (3D hero, in progress) · Umami analytics (cookieless) · Vercel · GitHub Actions.

Design: **Signal**, graphic retro futurism for code. See [`doc/design/design-principles.md`](doc/design/design-principles.md) and open [`doc/design/style-bible.html`](doc/design/style-bible.html) in a browser.

## Add a project or a post

Everything on the site comes from Markdown in `src/content/`. Push a file to `main` (through a PR) and Vercel rebuilds; it is live in about a minute.

**Project** → `src/content/projects/<slug>.md` (the filename is the URL: `/projects/<slug>`)

```md
---
title: CircleFlow
summary: One or two sentences. Shown on cards, in the terminal and as the meta description.
build: 0.1.0 # optional, a real version only
status: active # live | active | shipped | archived
year: 2026 # optional
stack: [React, TypeScript]
cover: ../../assets/projects/circleflow.webp # optional; put the image in src/assets/projects/
coverAlt: What the image shows. # required when cover is set
links: { repo: https://github.com/..., live: https://... } # optional
featured: true # optional
order: 1 # lower sorts first
draft: false # drafts show in `npm run dev` only
---

Body in Markdown (or `.mdx` to embed components).
```

**Post** → `src/content/posts/<slug>.md` (`/blog/<slug>`)

```md
---
title: Rebuilding this site
summary: One or two sentences.
date: 2026-09-29
tags: [astro, meta]
---
```

**Job** → `src/content/experience/<slug>.md` (shown on the home page, on `/about` and by the terminal's `resume` command)

```md
---
role: Software Developer, Full Stack
org: UNIFYI
orgNote: Acquired by Keandrews # optional
location: Dallas, TX
start: 2023-10
end: present # or YYYY-MM
summary: One line.
stack: [Java, Spring Boot, Angular]
metrics: # optional; real, sourced numbers only
  - { value: '28', unit: '%', label: 'Client acquisition increase' }
---

### Project name

- Bullets.
```

Education, skills and links live in [`src/site.config.ts`](src/site.config.ts).

Frontmatter is validated in [`src/content.config.ts`](src/content.config.ts). A missing or mistyped field fails the build and the PR check instead of breaking a page.

New projects and posts show up in the terminal automatically (`ls projects`, `open <slug>`).

## The 3D hero

The home page opens on TRV-01, a computer you scroll into. Its screen runs the same terminal engine. Everything about it is in [`doc/3D-MODEL.md`](doc/3D-MODEL.md), including how to drop in a modelled `.glb` from Blender. Append `?flat` to any URL to see the flat fallback.

## Add a terminal command

Drop a file in [`src/terminal/commands/`](src/terminal/commands) that default-exports a `Command` (or an array of them). Set `hidden: true` for an easter egg; it runs but never appears in `help` or tab completion. The engine is pure TypeScript with no DOM, tested in [`src/terminal/engine.test.ts`](src/terminal/engine.test.ts).

## Analytics

[Umami](https://umami.is) Cloud: cookieless, no personal data, no consent banner, respects Do Not Track. The public privacy note is at [`/privacy`](src/pages/privacy.astro); update it whenever the tracked events change.

- **Enable:** put the website ID in `analytics.websiteId` in [`src/site.config.ts`](src/site.config.ts). Empty means off.
- **Where it runs:** only on Vercel production builds. Previews, local builds and CI never load it. The script and collector are proxied through `/stats` (rewrites in `vercel.json`), so they're first-party.
- **Events:** every event and its data shape is declared in [`src/lib/analytics.ts`](src/lib/analytics.ts). Use `track(event, data)` in scripts, or spread `trackAttrs(event, data)` onto a link for click tracking. The terminal reports command names only, never what was typed after them.

## Roadmap

See [`doc/ROADMAP.md`](doc/ROADMAP.md).

## Develop

Node 22.12 or newer (`.nvmrc`).

```sh
npm ci
npm run dev          # http://localhost:4321
npm run verify       # format, lint, types, unit tests, build: what CI's first job runs
npm run test:e2e     # Playwright smoke tests against the build (run `npm run build` first)
npm run check:links  # internal link check over dist/
```

## Ship

- `main` is production and is protected. Work on a branch and open a PR.
- The **PR title** becomes the squash commit, so it must be a [Conventional Commit](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `content: add CircleFlow post`, `docs: …`, `ci: …`, `chore: …`.
- Every PR runs **Verify** (format, lint, `astro check`, Vitest, build), **E2E** (Playwright, desktop and mobile), **Lighthouse** (score and JS budgets), **Links** and **PR title**, and gets a Vercel preview URL.
- Merging deploys to production. Vercel can roll back to any earlier deploy instantly.
- [release-please](https://github.com/googleapis/release-please) keeps a `chore(main): release x.y.z` PR open with the changelog. Merge it to tag a version and publish a GitHub Release.
- Dependabot opens weekly dependency PRs; they go through the same checks.

## Layout

```
src/
  content/          projects and posts (Markdown)
  content.config.ts frontmatter schemas
  terminal/         terminal engine, virtual file system, commands (no DOM)
  components/       Astro components; terminal/ holds the React (flat) renderer
  hero/             the 3D hero: TRV-01 config, scene, CRT shader, screen renderer
  layouts/          page shell
  pages/            routes
  styles/           design tokens and shared kit (global.css), long-form prose
doc/design/         the Signal design system
e2e/                Playwright smoke tests
scripts/            link checker
```
