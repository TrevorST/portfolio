import { describe, expect, it, vi } from 'vitest';
import { MAX_LINES, TerminalEngine, tokenize } from './engine';
import { commands } from './registry';
import type { Command, SiteData, TerminalHost } from './types';

const data: SiteData = {
  name: 'Trevor Taylor',
  handle: 'trevor',
  role: 'Software engineer',
  bio: 'Builds tools.',
  email: 'me@example.com',
  links: [{ label: 'GitHub', href: 'https://github.com/example' }],
  projects: [
    {
      slug: 'circleflow',
      title: 'CircleFlow',
      summary: 'Logos from circles.',
      url: '/projects/circleflow',
      tags: ['react'],
      meta: 'BUILD 0.1.0',
    },
    {
      slug: 'moodbox',
      title: 'MoodBox',
      summary: 'Prototyping studio.',
      url: '/projects/moodbox',
      tags: [],
    },
  ],
  posts: [{ slug: 'hello', title: 'Hello', summary: 'First post.', url: '/blog/hello', tags: [] }],
  experience: [
    {
      role: 'Software Developer',
      org: 'Acme',
      location: 'Dallas, TX',
      dates: 'OCT 2023 – PRESENT',
      summary: 'Builds platforms.',
    },
  ],
  education: [{ degree: 'B.S. Computer Science', school: 'ETSU', dates: 'AUG 2018 – AUG 2023' }],
  skills: [{ group: 'Languages', items: ['Java', 'C#'] }],
  build: { version: '0.1.0', commit: 'abc1234', date: '2026-09-29' },
};

function setup(extra: Command[] = []) {
  const host: TerminalHost = {
    navigate: vi.fn(),
    sleep: () => Promise.resolve(),
    now: () => new Date('2026-09-29T12:00:00Z'),
  };
  const term = new TerminalEngine({ data, commands: [...commands, ...extra], host });
  const text = () =>
    term
      .getSnapshot()
      .lines.map((l) => l.text)
      .join('\n');
  return { term, host, text };
}

describe('tokenize', () => {
  it('splits on whitespace and keeps quoted words together', () => {
    expect(tokenize(`echo  "hello world" 'a b'  c`)).toEqual(['echo', 'hello world', 'a b', 'c']);
  });
  it('keeps empty quoted arguments', () => {
    expect(tokenize(`echo ""`)).toEqual(['echo', '']);
  });
});

describe('TerminalEngine', () => {
  it('registers every command module and rejects duplicate names', () => {
    expect(() => setup([{ name: 'ls', summary: 'dupe', run() {} }])).toThrow(/Duplicate/);
    const { term } = setup();
    expect(term.commands.map((c) => c.name)).toEqual(
      expect.arrayContaining(['help', 'ls', 'cat', 'open']),
    );
  });

  it('boots once, reporting real content counts', async () => {
    const { term, text } = setup();
    await term.boot({ fast: true });
    await term.boot({ fast: true });
    expect(term.getSnapshot().booted).toBe(true);
    expect(text()).toContain('projects .......... 2 loaded');
    expect(text().match(/READY/g)).toHaveLength(1);
  });

  it('echoes input with the prompt and reports unknown commands', async () => {
    const { term, text } = setup();
    await term.execute('nope');
    expect(text()).toContain('guest@trv:~$ nope');
    expect(term.getSnapshot().lines.at(-1)).toMatchObject({ kind: 'error' });
  });

  it('help lists visible commands but not hidden ones', async () => {
    const { term, text } = setup();
    await term.execute('help');
    expect(text()).toContain('projects');
    expect(text()).not.toMatch(/^\s+sudo/m);
  });

  it('navigates the virtual file system built from content', async () => {
    const { term, text } = setup();
    await term.execute('cd projects');
    expect(term.getSnapshot().prompt).toBe('guest@trv:~/projects$');
    await term.execute('ls');
    expect(text()).toContain('circleflow.md');
    await term.execute('cat circleflow.md');
    expect(text()).toContain('Logos from circles.');
    await term.execute('cd ..');
    await term.execute('pwd');
    expect(term.getSnapshot().lines.at(-1)?.text).toBe('/home/trevor');
  });

  it('hides dotfiles unless asked', async () => {
    const { term, text } = setup();
    await term.execute('ls');
    expect(text()).not.toContain('.plan');
    await term.execute('ls -a');
    expect(text()).toContain('.plan');
  });

  it('opens content by path or by slug through the host', async () => {
    const { term, host } = setup();
    await term.execute('open projects/moodbox.md');
    await term.execute('open hello');
    expect(host.navigate).toHaveBeenNthCalledWith(1, '/projects/moodbox');
    expect(host.navigate).toHaveBeenNthCalledWith(2, '/blog/hello');
  });

  it('turns a thrown command error into an error line', async () => {
    const { term } = setup();
    await term.execute('cat missing.txt');
    expect(term.getSnapshot().lines.at(-1)).toMatchObject({
      kind: 'error',
      text: 'cat: missing.txt: no such file or directory',
    });
  });

  it('walks history and restores the draft', async () => {
    const { term } = setup();
    await term.execute('pwd');
    await term.execute('ls');
    expect(term.historyPrev('half-typed')).toBe('ls');
    expect(term.historyPrev('ignored')).toBe('pwd');
    expect(term.historyNext()).toBe('ls');
    expect(term.historyNext()).toBe('half-typed');
  });

  it('completes commands, then paths, then lists ambiguous candidates', () => {
    const { term } = setup();
    expect(term.complete('pro').value).toBe('projects ');
    expect(term.complete('cd pr').value).toBe('cd projects/');
    expect(term.complete('cat projects/c').value).toBe('cat projects/circleflow.md ');
    const amb = term.complete('c');
    expect(amb.candidates).toEqual(expect.arrayContaining(['cat', 'cd', 'clear', 'contact']));
  });

  it('caps the scrollback', async () => {
    const { term } = setup();
    for (let i = 0; i < MAX_LINES; i++) await term.execute(`echo ${i}`);
    expect(term.getSnapshot().lines).toHaveLength(MAX_LINES);
  });

  it('fib keeps the old site working, with big numbers', async () => {
    const { term } = setup();
    await term.execute('fib 90');
    expect(term.getSnapshot().lines.at(-1)?.text.endsWith('1779979416004714189')).toBe(true);
  });

  it('resume and resume.txt read the same experience, education and skills', async () => {
    const { term, text } = setup();
    await term.execute('resume');
    const fromCommand = text();
    for (const expected of [
      'Software Developer',
      'Acme · Dallas, TX',
      'B.S. Computer Science',
      'Java, C#',
    ]) {
      expect(fromCommand).toContain(expected);
    }
    expect(term.getSnapshot().lines.at(-1)).toMatchObject({ href: '/about' });
    term.clear();
    await term.execute('cat resume.txt');
    expect(text()).toContain('OCT 2023 – PRESENT');
  });

  it('whoami leads with the current role', async () => {
    const { term, text } = setup();
    await term.execute('whoami');
    expect(text()).toContain('Software Developer · Acme');
  });
});
