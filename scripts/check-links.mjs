#!/usr/bin/env node
/**
 * Internal link check over the built site. Every root-relative href/src in
 * dist/**.html must resolve to a built file, and every same-page #fragment
 * must match an id on its target page. External links are not fetched here;
 * they are too flaky to gate a merge on.
 *
 * Usage: node scripts/check-links.mjs [distDir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Map a root-relative URL path to the file the static host would serve. */
function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates =
    clean === '' ? ['index.html'] : [clean, `${clean}.html`, join(clean, 'index.html')];
  return candidates.map((c) => join(dist, c)).find((f) => existsSync(f) && statSync(f).isFile());
}

const idsCache = new Map();
function idsIn(file) {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

const pages = walk(dist).filter((f) => f.endsWith('.html'));
const broken = [];
let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const pagePath = `/${relative(dist, page).split(sep).join('/')}`.replace(/(index)?\.html$/, '');
  for (const [, attr, url] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(url)) continue;
    if (!url.startsWith('/') && !url.startsWith('#')) continue;
    checked++;
    const [pathPart, fragment] = url.split('#');
    const target = pathPart ? resolveFile(pathPart.split('?')[0]) : page;
    if (!target) {
      broken.push(`${pagePath}: ${attr}="${url}" -> no such file`);
      continue;
    }
    if (fragment && target.endsWith('.html') && !idsIn(target).has(fragment)) {
      broken.push(`${pagePath}: ${attr}="${url}" -> no element with id "${fragment}"`);
    }
  }
}

if (broken.length) {
  console.error(`Broken internal links (${broken.length}):\n  ${broken.join('\n  ')}`);
  process.exit(1);
}
console.log(`Links OK: ${checked} internal links across ${pages.length} pages.`);
