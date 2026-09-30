import type { TerminalEngine } from './engine';

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface KeyResult {
  /** The input line after the key. */
  value: string;
  /** True when the key was consumed (the caller should preventDefault). */
  handled: boolean;
}

/**
 * Shell keybindings, shared by every renderer: Enter runs, Tab completes,
 * Up/Down walk history, Ctrl+L clears, Ctrl+C abandons the line. Anything
 * else is left to the input element.
 */
export function applyKey(engine: TerminalEngine, e: KeyInput, value: string): KeyResult {
  const ctrl = e.ctrlKey || e.metaKey;
  switch (true) {
    case e.key === 'Enter':
      void engine.execute(value);
      return { value: '', handled: true };
    case e.key === 'Tab': {
      if (!value) return { value, handled: false }; // let Tab move focus
      const { value: next, candidates } = engine.complete(value);
      if (candidates.length > 1) engine.print(candidates.join('   '), 'dim');
      return { value: next, handled: true };
    }
    case e.key === 'ArrowUp':
      return { value: engine.historyPrev(value), handled: true };
    case e.key === 'ArrowDown':
      return { value: engine.historyNext(), handled: true };
    case ctrl && e.key.toLowerCase() === 'l':
      engine.clear();
      return { value, handled: true };
    case e.ctrlKey && e.key.toLowerCase() === 'c':
      engine.print(`${engine.getSnapshot().prompt} ${value}^C`, 'input');
      return { value: '', handled: true };
    default:
      return { value, handled: false };
  }
}
