import { describe, expect, it } from 'vitest';
import { Life } from './life';

const alive = (l: Life) => {
  const out: string[] = [];
  for (let y = 0; y < l.rows; y++)
    for (let x = 0; x < l.cols; x++) if (l.get(x, y)) out.push(`${x},${y}`);
  return out.sort();
};

describe('Life', () => {
  it('a blinker oscillates with period 2', () => {
    const l = new Life(5, 5);
    [1, 2, 3].forEach((x) => l.set(x, 2, true));
    l.step();
    expect(alive(l)).toEqual(['2,1', '2,2', '2,3']);
    l.step();
    expect(alive(l)).toEqual(['1,2', '2,2', '3,2']);
  });

  it('a block is still life', () => {
    const l = new Life(4, 4);
    [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ].forEach(([x, y]) => l.set(x!, y!, true));
    expect(l.step()).toBe(4);
    expect(alive(l)).toEqual(['1,1', '1,2', '2,1', '2,2']);
  });

  it('a glider keeps five cells and wraps around the edges', () => {
    const l = new Life(8, 8);
    l.glider(5, 5);
    for (let i = 0; i < 40; i++) expect(l.step()).toBe(5);
  });

  it('seeds at roughly the requested density', () => {
    let s = 1;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const l = new Life(100, 100).seed(0.2, rand);
    expect(l.population() / 10_000).toBeGreaterThan(0.17);
    expect(l.population() / 10_000).toBeLessThan(0.23);
  });
});
