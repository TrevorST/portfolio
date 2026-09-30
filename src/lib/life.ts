/**
 * Conway's Game of Life on a wrapping (toroidal) grid. Pure: no DOM, so the
 * background canvas and the terminal's hidden `life` command share it.
 */
export class Life {
  cells: Uint8Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.cells = new Uint8Array(cols * rows);
  }

  /** Fill with live cells at the given density (0..1). */
  seed(density: number, random: () => number = Math.random): this {
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = random() < density ? 1 : 0;
    return this;
  }

  get(x: number, y: number): number {
    const cx = ((x % this.cols) + this.cols) % this.cols;
    const cy = ((y % this.rows) + this.rows) % this.rows;
    return this.cells[cy * this.cols + cx] ?? 0;
  }

  set(x: number, y: number, alive: boolean): void {
    const cx = ((x % this.cols) + this.cols) % this.cols;
    const cy = ((y % this.rows) + this.rows) % this.rows;
    this.cells[cy * this.cols + cx] = alive ? 1 : 0;
  }

  /** Drop a glider at (x, y), heading down-right; the classic reseed. */
  glider(x: number, y: number): void {
    for (const [dx, dy] of [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ] as const) {
      this.set(x + dx, y + dy, true);
    }
  }

  /** Advance one generation. Returns the number of live cells. */
  step(): number {
    const { cols, rows, cells } = this;
    const next = new Uint8Array(cols * rows);
    let alive = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy)
              n += cells[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)] ?? 0;
          }
        }
        const i = y * cols + x;
        const v = n === 3 || (n === 2 && cells[i]) ? 1 : 0;
        next[i] = v;
        alive += v;
      }
    }
    this.cells = next;
    return alive;
  }

  population(): number {
    let n = 0;
    for (const c of this.cells) n += c;
    return n;
  }
}
