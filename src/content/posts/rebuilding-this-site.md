---
title: Rebuilding this site
summary: The old portfolio was one HTML file, jQuery and a fake terminal. The new one is Astro, Markdown in git, and a terminal that actually reads the site.
date: 2026-09-29
tags: [astro, meta, ci]
---

The 2023 version of this site was a single `index.html` with jQuery, Swiper and a terminal that could run `help`, `echo` and `fib`. A lot has changed since then, so the site is being rebuilt from the ground up.

## The rules

- **Content is Markdown in git.** Every project and post is a `.md` file. Push one and Vercel rebuilds; it is live in about a minute. Frontmatter is schema-checked, so a typo fails the build instead of breaking a page.
- **Zero JavaScript by default.** Pages are static HTML. Interactive pieces, like the terminal, load as islands only where they appear.
- **Every change goes through a pull request.** Formatting, lint, type checks, unit tests, a production build, browser smoke tests, a link check and a Lighthouse budget all have to pass before anything reaches `main`.
- **Versions are real.** Commits follow Conventional Commits, and release-please turns them into a changelog and a tagged release.

## The terminal

The terminal on the home page is not a toy. Its engine is plain TypeScript with no DOM, and its file system is generated from this site's content, so `ls projects` lists real projects and `open circleflow` takes you there. Each command is one small file, so adding one (or hiding one) is adding a file.

Try `help`. Not everything is listed.

## Next

v0.2 puts that same engine on the screen of a 3D computer you scroll into.
