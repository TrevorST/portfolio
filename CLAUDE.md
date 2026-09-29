# CLAUDE.md

Trevor Taylor's portfolio: Astro (static), TypeScript strict, React islands only where needed, deployed on Vercel. Read `README.md` first.

## Rules

- **Design is Signal.** Follow `doc/design/design-principles.md`. Tokens and the shared kit (tag, panel, btn, chips, kv, hazard, stat) live in `src/styles/global.css`; component styles stay scoped. Acid green `--signal` is the only loud colour; `--flare` only for errors and glitch, `--hazard` only for warnings. Square corners, no soft shadows.
- **Labels carry real data.** Build tags, dates, commits and counts come from content or `__BUILD__`; never invent metrics or versions.
- **Zero JS by default.** A page ships JavaScript only through an island (`client:*`) or a small inline `<script>`. Keep Lighthouse at the budget in `lighthouserc.cjs`.
- **Motion respects `prefers-reduced-motion`.** Everything must work, and read, without it.
- **The terminal engine (`src/terminal/`) has no DOM and no React.** Renderers (`src/components/terminal/`) subscribe to it. v0.2 adds a 3D renderer for the same engine, so keep that boundary.
- Content changes go in `src/content/`; schemas in `src/content.config.ts`.
- **Analytics is Umami** (cookieless, no personal data). The only tracker entry point is `src/components/Analytics.astro`; every event and its data shape is declared in `src/lib/analytics.ts`. It loads only on Vercel production builds. Never send typed terminal input or personal data. Keep `/privacy` accurate when events change.
- The old site in `oldwebsitecopy/` is reference only and is gitignored.

## Commands

- `npm run dev`, `npm run build`, `npm run preview`
- `npm run verify`: format check, lint, `astro check`, Vitest, build
- `npm run test:e2e`: Playwright against the build
- `npm run check:links`, `npm run lhci`

## Git

- Never push to `main`; branch and open a PR. PR titles are Conventional Commits (squash merge; release-please reads them).
- Trevor merges.
