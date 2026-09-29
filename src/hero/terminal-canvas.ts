import type { Line, LineKind, Snapshot } from '~/terminal/types';

/**
 * Paints a terminal snapshot onto a 2D canvas, which the 3D scene uses as the
 * CRT screen texture. Pure drawing: no engine, no three.js.
 */

const COLORS: Record<LineKind, string> = {
  input: '#E9E7E0',
  output: '#C6FF1A',
  accent: '#C6FF1A',
  system: '#E9E7E0',
  dim: '#7C838B',
  error: '#FF2E7E',
};
const GLOW: Partial<Record<LineKind, string>> = {
  output: 'rgba(198,255,26,0.55)',
  accent: 'rgba(198,255,26,0.7)',
  error: 'rgba(255,46,126,0.5)',
};

export interface TerminalCanvasOptions {
  /** Rows of text that fit on screen; fewer rows means bigger text. */
  rows: number;
  font: string;
}

export class TerminalCanvas {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pad = 40;
  private lineH = 0;
  private charW = 0;
  private rows = 0;

  constructor(
    width: number,
    height: number,
    private opts: TerminalCanvasOptions,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.layout();
  }

  setRows(rows: number): void {
    this.opts = { ...this.opts, rows };
    this.layout();
  }

  private layout(): void {
    const { height } = this.canvas;
    this.rows = this.opts.rows;
    this.lineH = Math.floor((height - this.pad * 2) / (this.rows + 1));
    const size = Math.floor(this.lineH * 0.62);
    this.ctx.font = `700 ${size}px ${this.opts.font}`;
    this.ctx.textBaseline = 'top';
    this.charW = this.ctx.measureText('M').width || size * 0.6;
  }

  /**
   * Wrap long lines to the screen width at word boundaries (measured, since
   * the pixel font is proportional), keeping each piece's kind. Leading
   * indentation survives; a word wider than the screen is hard-broken.
   */
  private wrap(lines: readonly Line[]): { text: string; kind: LineKind }[] {
    const out: { text: string; kind: LineKind }[] = [];
    const max = this.canvas.width - this.pad * 2;
    const fits = (s: string) => this.ctx.measureText(s).width <= max;
    for (const line of lines) {
      const text = line.text || ' ';
      if (fits(text)) {
        out.push({ text, kind: line.kind });
        continue;
      }
      let current = '';
      for (const word of text.split(/(?<=\s)/)) {
        if (fits(current + word)) {
          current += word;
          continue;
        }
        if (current.trim()) out.push({ text: current.trimEnd(), kind: line.kind });
        current = word;
        while (!fits(current)) {
          let cut = current.length - 1;
          while (cut > 1 && !fits(current.slice(0, cut))) cut--;
          out.push({ text: current.slice(0, cut), kind: line.kind });
          current = current.slice(cut);
        }
      }
      if (current.trim()) out.push({ text: current.trimEnd(), kind: line.kind });
    }
    return out;
  }

  draw(snap: Snapshot, input: string, cursorOn: boolean, hint: string): void {
    const { ctx, canvas, pad, lineH } = this;
    ctx.save();
    ctx.fillStyle = '#040604';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // output, newest at the bottom, above the prompt row
    const rows = this.wrap(snap.lines).slice(-(this.rows - 1));
    rows.forEach((row, i) => {
      ctx.fillStyle = COLORS[row.kind];
      const glow = GLOW[row.kind];
      ctx.shadowColor = glow ?? 'transparent';
      ctx.shadowBlur = glow ? 10 : 0;
      ctx.fillText(row.text, pad, pad + i * lineH);
    });

    // prompt row, pinned to the bottom
    const y = pad + (this.rows - 1) * lineH;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(198,255,26,0.25)';
    ctx.fillRect(pad, y - lineH * 0.35, canvas.width - pad * 2, 2);
    // the pixel font is proportional, so position by measured width
    const ps1 = `${snap.prompt} `;
    const x0 = pad + ctx.measureText(ps1).width;
    const room = canvas.width - pad - x0 - this.charW;
    let shown = input;
    while (shown && ctx.measureText(shown).width > room) shown = shown.slice(1);
    ctx.fillStyle = '#7C838B';
    ctx.fillText(ps1, pad, y);
    ctx.fillStyle = '#E9E7E0';
    ctx.fillText(shown, x0, y);
    if (!shown && hint) {
      ctx.fillStyle = 'rgba(198,255,26,0.35)';
      ctx.fillText(hint, x0 + this.charW * 1.4, y);
    }
    if (cursorOn) {
      ctx.fillStyle = '#C6FF1A';
      ctx.shadowColor = 'rgba(198,255,26,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillRect(x0 + ctx.measureText(shown).width, y, this.charW * 0.8, lineH * 0.7);
    }
    ctx.restore();
  }

  /** Blank screen with a single status line (before power-on finishes). */
  drawIdle(message: string): void {
    const { ctx, canvas, pad } = this;
    ctx.fillStyle = '#040604';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7C838B';
    ctx.fillText(message, pad, pad);
  }
}
