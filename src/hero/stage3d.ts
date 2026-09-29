import fontUrl from '~/assets/fonts/PixeloidSans-Bold.ttf?url';
import { track } from '~/lib/analytics';
import { TerminalEngine } from '~/terminal/engine';
import { applyKey } from '~/terminal/keyboard';
import { commands } from '~/terminal/registry';
import type { SiteData, TerminalHost } from '~/terminal/types';
import { HeroScene, PHASE } from './scene';
import { TerminalCanvas } from './terminal-canvas';
import { TRV01 } from './trv01';

/**
 * The heavy half of the hero, loaded on first interaction: three.js scene,
 * the terminal engine, the screen canvas, and the real <input> that sits
 * invisibly over the screen so typing (and the phone keyboard) just work.
 */

const BOOTED_KEY = 'trv.booted';
const FONT = "'Pixeloid Sans', ui-monospace, monospace";

export interface Stage {
  setProgress(p: number): void;
}

export interface StageElements {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  input: HTMLInputElement;
  log: HTMLElement;
}

function sessionFlag(write?: boolean): boolean {
  try {
    if (write) sessionStorage.setItem(BOOTED_KEY, '1');
    return sessionStorage.getItem(BOOTED_KEY) === '1';
  } catch {
    return false;
  }
}

export async function mountStage(
  els: StageElements,
  data: SiteData,
  opts: { hasModel: boolean },
): Promise<Stage> {
  const { root, canvas, input, log } = els;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    const face = new FontFace('Pixeloid Sans', `url(${fontUrl})`, { weight: '700' });
    document.fonts.add(await face.load());
  } catch {
    /* falls back to the monospace stack */
  }

  const rowsFor = () => (canvas.clientWidth < 640 ? 10 : 17);
  const { width, height } = TRV01.texture;
  const screen = new TerminalCanvas(width, height, { rows: rowsFor(), font: FONT });
  const scene = await HeroScene.create(canvas, screen.canvas, {
    version: data.build.version,
    hasModel: opts.hasModel,
  });

  const host: TerminalHost = {
    navigate(href) {
      const url = new URL(href, location.href);
      if (url.origin === location.origin || url.protocol === 'mailto:') location.assign(url);
      else window.open(url, '_blank', 'noopener');
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date(),
    onCommand(command, { hidden }) {
      track('terminal-command', { command });
      if (hidden) track('easter-egg', { command });
      if (command === 'resume') track('resume-view', { source: 'terminal' });
    },
  };
  const engine = new TerminalEngine({ data, commands, host });

  let value = '';
  let powered = false;
  let poweringOn = false;
  let cursorOn = true;
  let inHold = false;
  let lastLogId = 0;

  const redraw = () => {
    if (!powered) {
      screen.drawIdle('');
    } else {
      const focused = document.activeElement === input;
      const hint = focused ? '' : coarse ? 'tap to type' : 'click or start typing';
      screen.draw(engine.getSnapshot(), value, cursorOn && focused, hint);
    }
    scene.screenChanged();
  };

  // screen-reader mirror of the output (the canvas is invisible to them)
  const mirror = () => {
    const { lines } = engine.getSnapshot();
    if (lines.length === 0) log.replaceChildren(); // `clear`
    for (const line of lines) {
      if (line.id <= lastLogId) continue;
      const div = document.createElement('div');
      div.textContent = line.text;
      log.append(div);
      lastLogId = line.id;
    }
    while (log.childElementCount > 60) log.firstElementChild?.remove();
  };

  engine.subscribe(() => {
    mirror();
    redraw();
  });

  setInterval(() => {
    if (!powered || !inHold) return;
    cursorOn = !cursorOn;
    redraw();
  }, 530);

  const powerOn = () => {
    if (powered || poweringOn) return;
    poweringOn = true;
    const fast = reduce || sessionFlag();
    const duration = fast ? 280 : 950;
    const start = performance.now();
    powered = true;
    redraw();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      scene.setPower(t);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      poweringOn = false;
      root.dataset.powered = '';
      track('terminal-power-on');
      void engine.boot({ fast }).then(() => sessionFlag(true));
    };
    requestAnimationFrame(step);
  };

  const placeInput = () => {
    const r = scene.screenRect();
    Object.assign(input.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };

  input.addEventListener('input', () => {
    value = input.value;
    cursorOn = true;
    redraw();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Esc quits a full-screen command first; a second Esc releases focus
      if (!engine.interrupt()) input.blur();
      e.preventDefault();
      redraw();
      return;
    }
    const res = applyKey(engine, e, value);
    if (res.handled) e.preventDefault();
    if (res.value !== value) {
      value = res.value;
      input.value = value;
    }
    cursorOn = true;
    redraw();
  });
  input.addEventListener('focus', redraw);
  input.addEventListener('blur', redraw);

  // desktop: typing anywhere while the screen fills the view goes to the terminal
  document.addEventListener('keydown', (e) => {
    if (!inHold || coarse || e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== input) return;
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')
      input.focus({ preventScroll: true });
  });

  window.addEventListener(
    'pointermove',
    (e) => scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
    { passive: true },
  );

  new ResizeObserver(() => {
    scene.resize(canvas.clientWidth, canvas.clientHeight);
    screen.setRows(rowsFor());
    redraw();
    if (inHold) placeInput();
  }).observe(canvas);

  new IntersectionObserver(([entry]) => scene.setVisible(entry?.isIntersecting ?? false)).observe(
    root,
  );

  redraw();

  return {
    setProgress(p) {
      scene.setProgress(p);
      const hold = p > PHASE.zoomEnd * 0.92 && p < PHASE.holdEnd;
      if (hold !== inHold) {
        inHold = hold;
        root.toggleAttribute('data-hold', hold);
        if (!hold && document.activeElement === input) input.blur();
      }
      if (hold) {
        powerOn();
        placeInput();
        if (!coarse && (document.activeElement === document.body || !document.activeElement)) {
          input.focus({ preventScroll: true });
        }
      }
    },
  };
}
