import { Life } from '../../lib/life';
import type { Command } from '../types';

const COLS = 44;
const ROWS = 14;
const FRAME_MS = 110;
const MAX_GENERATIONS = 3000;

function frame(life: Life, gen: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < life.rows; y++) {
    let row = '';
    for (let x = 0; x < life.cols; x++) row += life.get(x, y) ? '█' : ' ';
    lines.push(row);
  }
  const pop = String(life.population()).padStart(3, '0');
  lines.push('', `// LIFE // GEN ${String(gen).padStart(4, '0')} · POP ${pop} · any key exits`);
  return lines;
}

/** Easter egg: the hero's old background, running on the terminal itself. */
const life: Command = {
  name: 'life',
  summary: "Conway's Game of Life",
  hidden: true,
  async run({ setScreen, signal, host, print }) {
    const grid = new Life(COLS, ROWS).seed(0.28);
    let gen = 0;
    while (!signal.aborted && gen < MAX_GENERATIONS) {
      setScreen(frame(grid, gen));
      await host.sleep(FRAME_MS);
      if (grid.step() < 6) grid.seed(0.28); // extinct: start a new colony
      gen++;
    }
    setScreen(null);
    print(`life: ${gen} generations. B3/S23. The old hero sends its regards.`, 'dim');
  },
};

export default life;
