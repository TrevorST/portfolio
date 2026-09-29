import type { SiteData } from '~/terminal/types';
import type { Stage } from './stage3d';

/**
 * The light half of the hero, on every page load (a few KB). It tracks scroll
 * progress through the pinned section, drives the CSS for the intro text,
 * and loads the 3D stage (three.js) only once the visitor interacts, so the
 * first paint and the Lighthouse budget never pay for it.
 *
 * Mode is decided before paint by the inline script in Hero.astro:
 * html[data-hero="3d"] or html[data-hero="flat"] (reduced motion, no WebGL,
 * Save-Data, ?flat).
 */

const root = document.querySelector<HTMLElement>('[data-hero-root]');
const html = document.documentElement;

function fallBackToFlat(err?: unknown) {
  if (err) console.warn('3D hero unavailable, using the flat terminal.', err);
  html.dataset.hero = 'flat';
}

if (root && html.dataset.hero === '3d') {
  let stage: Stage | null = null;
  let loading = false;
  let progress = 0;
  let queued = false;

  const measure = () => {
    queued = false;
    const rect = root.getBoundingClientRect();
    const travel = rect.height - innerHeight;
    progress = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
    root.style.setProperty('--p', progress.toFixed(4));
    root.dataset.phase = progress < 0.3 ? 'intro' : progress < 0.72 ? 'hold' : 'outro';
    stage?.setProgress(progress);
  };
  const onScroll = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(measure);
    }
  };

  const load = () => {
    if (loading) return;
    loading = true;
    for (const type of TRIGGERS) removeEventListener(type, load);
    const data = JSON.parse(
      document.getElementById('terminal-data')?.textContent ?? 'null',
    ) as SiteData;
    const canvas = root.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    const input = root.querySelector<HTMLInputElement>('[data-hero-input]');
    const log = root.querySelector<HTMLElement>('[data-hero-log]');
    if (!data || !canvas || !input || !log) return fallBackToFlat('hero markup missing');
    import('./stage3d')
      .then((m) =>
        m.mountStage({ root, canvas, input, log }, data, {
          hasModel: root.dataset.model === 'glb',
        }),
      )
      .then((s) => {
        stage = s;
        root.dataset.ready = '';
        s.setProgress(progress);
      })
      .catch(fallBackToFlat);
  };

  const TRIGGERS = [
    'pointermove',
    'pointerdown',
    'touchstart',
    'wheel',
    'keydown',
    'scroll',
  ] as const;
  for (const type of TRIGGERS) addEventListener(type, load, { passive: true, once: true });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  measure();
  if (progress > 0) load(); // arrived mid-page (reload, back button, #terminal)
}
