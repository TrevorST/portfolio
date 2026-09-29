import { afterEach, describe, expect, it, vi } from 'vitest';
import { track, trackAttrs } from './analytics';

describe('track', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a no-op on the server', () => {
    expect(() => track('terminal-command', { command: 'ls' })).not.toThrow();
  });

  it('is a no-op when the tracker script is not on the page', () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal('document', { querySelector: () => null });
    vi.stubGlobal('window', { umami });
    track('contact-click', { channel: 'email', from: 'home' });
    expect(umami.track).not.toHaveBeenCalled();
  });

  it('sends immediately when the tracker is ready', () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal('document', { querySelector: () => ({ addEventListener: vi.fn() }) });
    vi.stubGlobal('window', { umami });
    track('terminal-command', { command: 'help' });
    expect(umami.track).toHaveBeenCalledWith('terminal-command', { command: 'help' });
  });

  it('queues until the deferred script loads, then flushes in order', () => {
    let onLoad: () => void = () => {};
    const win: { umami?: { track: ReturnType<typeof vi.fn> } } = {};
    vi.stubGlobal('document', {
      querySelector: () => ({ addEventListener: (_: string, fn: () => void) => (onLoad = fn) }),
    });
    vi.stubGlobal('window', win);
    track('resume-view', { source: 'page' });
    track('terminal-power-on');
    const umami = { track: vi.fn() };
    win.umami = umami;
    onLoad();
    expect(umami.track.mock.calls).toEqual([
      ['resume-view', { source: 'page' }],
      ['terminal-power-on', undefined],
    ]);
  });

  it('swallows tracker errors', () => {
    const umami = {
      track: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('document', { querySelector: () => ({ addEventListener: vi.fn() }) });
    vi.stubGlobal('window', { umami });
    expect(() => track('easter-egg', { command: 'sudo' })).not.toThrow();
  });
});

describe('trackAttrs', () => {
  it('builds Umami click-tracking attributes', () => {
    expect(trackAttrs('project-link', { project: 'circleflow', kind: 'repo' })).toEqual({
      'data-umami-event': 'project-link',
      'data-umami-event-project': 'circleflow',
      'data-umami-event-kind': 'repo',
    });
  });
});
