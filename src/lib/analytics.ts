/**
 * Privacy-first analytics (Umami: cookieless, no personal data, ~2 KB).
 *
 * Every event the site can send is declared here, with its data shape, so a
 * typo is a type error and the full list of what is collected lives in one
 * file. `track` is safe everywhere: it does nothing on the server, on
 * previews, locally, or when the script is blocked or not configured.
 */

export interface AnalyticsEvents {
  /** Command name only. Never the arguments or the raw input. */
  'terminal-command': { command: string };
  /** A hidden command was run. */
  'easter-egg': { command: string };
  /** The 3D terminal finished powering on (v0.2). */
  'terminal-power-on': Record<string, never>;
  'project-link': { project: string; kind: 'live' | 'demo' | 'repo' };
  'resume-view': { source: 'page' | 'terminal' };
  'contact-click': { channel: string; from: string };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

interface Umami {
  track(event: string, data?: Record<string, string | number>): void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

type Pending = [AnalyticsEvent, Record<string, string | number> | undefined];
const pending: Pending[] = [];
let waiting = false;

/** The tracker script, present only on production builds with an ID set. */
const script = () =>
  typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLScriptElement>('script[data-analytics]');

function flush() {
  const umami = window.umami;
  if (!umami) return;
  for (const [event, data] of pending.splice(0)) {
    try {
      umami.track(event, data);
    } catch {
      /* analytics must never break the page */
    }
  }
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...[data]: AnalyticsEvents[E] extends Record<string, never> ? [] : [AnalyticsEvents[E]]
): void {
  const tag = script();
  if (!tag) return; // not configured, not production, or server-side
  pending.push([event, data as Record<string, string | number> | undefined]);
  if (window.umami) {
    flush();
  } else if (!waiting) {
    // the script is deferred; send once it has loaded
    waiting = true;
    tag.addEventListener('load', flush, { once: true });
  }
}

/**
 * Click tracking with no JavaScript of our own: Umami reads these attributes.
 * Spread onto a link: <a {...trackAttrs('contact-click', { channel: 'email', from: 'home' })}>
 */
export function trackAttrs<E extends AnalyticsEvent>(
  event: E,
  data?: AnalyticsEvents[E],
): Record<string, string> {
  const attrs: Record<string, string> = { 'data-umami-event': event };
  for (const [key, value] of Object.entries(data ?? {})) {
    attrs[`data-umami-event-${key}`] = String(value);
  }
  return attrs;
}
