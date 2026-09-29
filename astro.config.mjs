// @ts-check
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Canonical URL for RSS, the sitemap and OG tags. The domain is the one on the
// resume; SITE_URL overrides it (for example, to test a different host).
const site = process.env.SITE_URL ?? 'https://www.trevortaylor.dev';

// Build stamp shown in the footer and by the terminal's `version` command.
// Labels carry real data (design principle P.02), so this is the actual commit.
function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const build = {
  version: pkg.version,
  commit: commit(),
  date: new Date().toISOString().slice(0, 10),
};

export default defineConfig({
  vite: {
    define: { __BUILD__: JSON.stringify(build) },
  },
  site,
  output: 'static',
  trailingSlash: 'never',
  // Inline all CSS: ~15 KB per page, and no render-blocking stylesheet request.
  build: { format: 'file', inlineStylesheets: 'always' },
  integrations: [mdx(), react(), sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    shikiConfig: { theme: 'vitesse-black' },
  },
});
