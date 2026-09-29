import { describe, expect, it, vi } from 'vitest';
import { TerminalEngine } from './engine';
import { applyKey } from './keyboard';
import { commands } from './registry';
import type { SiteData } from './types';

const data: SiteData = {
  name: 'T',
  handle: 't',
  role: 'r',
  bio: 'b',
  email: 'e@example.com',
  links: [],
  projects: [
    { slug: 'circleflow', title: 'C', summary: 's', url: '/projects/circleflow', tags: [] },
  ],
  posts: [],
  experience: [],
  education: [],
  skills: [],
  build: { version: '0.0.0', commit: 'abc', date: '2026-01-01' },
};

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

function setup() {
  const engine = new TerminalEngine({
    data,
    commands,
    host: { navigate: vi.fn(), sleep: () => Promise.resolve(), now: () => new Date() },
  });
  return engine;
}

describe('applyKey', () => {
  it('Enter runs the line and clears the input', async () => {
    const engine = setup();
    expect(applyKey(engine, key('Enter'), 'pwd')).toEqual({ value: '', handled: true });
    await vi.waitFor(() => expect(engine.getSnapshot().lines.at(-1)?.text).toBe('/home/trevor'));
  });

  it('Tab completes, and passes through on an empty line so focus can move', () => {
    const engine = setup();
    expect(applyKey(engine, key('Tab'), 'pro')).toEqual({ value: 'projects ', handled: true });
    expect(applyKey(engine, key('Tab'), '')).toEqual({ value: '', handled: false });
  });

  it('Up and Down walk history', async () => {
    const engine = setup();
    await engine.execute('whoami');
    expect(applyKey(engine, key('ArrowUp'), '').value).toBe('whoami');
    expect(applyKey(engine, key('ArrowDown'), 'whoami').value).toBe('');
  });

  it('Ctrl+L clears the screen, Ctrl+C abandons the line', async () => {
    const engine = setup();
    await engine.execute('pwd');
    expect(applyKey(engine, key('l', { ctrlKey: true }), 'x')).toEqual({
      value: 'x',
      handled: true,
    });
    expect(engine.getSnapshot().lines).toHaveLength(0);
    expect(applyKey(engine, key('c', { ctrlKey: true }), 'half').value).toBe('');
    expect(engine.getSnapshot().lines.at(-1)?.text).toMatch(/half\^C$/);
  });

  it('leaves ordinary keys to the input element', () => {
    expect(applyKey(setup(), key('a'), 'x')).toEqual({ value: 'x', handled: false });
  });
});
