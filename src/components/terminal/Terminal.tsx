import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { TerminalEngine } from '~/terminal/engine';
import { track } from '~/lib/analytics';
import { commands } from '~/terminal/registry';
import type { Line, SiteData, TerminalHost } from '~/terminal/types';
import './terminal.css';

/**
 * Flat (DOM) renderer for the terminal engine. v0.2 adds a second renderer that
 * paints the same engine onto the 3D CRT; this one stays as the reduced-motion
 * and no-WebGL fallback.
 */

const BOOTED_KEY = 'trv.booted';

const host: TerminalHost = {
  navigate(href) {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin || url.protocol === 'mailto:')
      window.location.assign(url);
    else window.open(url, '_blank', 'noopener');
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
  onCommand(command, { hidden }) {
    track('terminal-command', { command });
    if (hidden) track('easter-egg', { command });
    if (command === 'resume') track('resume-view', { source: 'terminal' });
  },
};

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the boot just plays again */
  }
}

function LineView({ line }: { line: Line }) {
  const cls = `term-line term-${line.kind}`;
  if (line.href) {
    const external = /^https?:/.test(line.href);
    return (
      <a
        className={cls}
        href={line.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {line.text || ' '}
      </a>
    );
  }
  return <div className={cls}>{line.text || ' '}</div>;
}

export default function Terminal({ data }: { data: SiteData }) {
  const [engine] = useState(() => new TerminalEngine({ data, commands, host }));
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [input, setInput] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Boot the first time the screen scrolls into view. Instant on revisits and
  // under reduced motion.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const fast =
          storageGet(BOOTED_KEY) === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
        void engine.boot({ fast }).then(() => storageSet(BOOTED_KEY, '1'));
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [engine]);

  // Keep the newest output in view (scrolls the screen, never the page).
  useEffect(() => {
    const out = outRef.current;
    if (out) out.scrollTop = out.scrollHeight;
  }, [snap.lines]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (snap.busy) return;
      const line = input;
      setInput('');
      void engine.execute(line);
    } else if (e.key === 'Tab') {
      if (!input) return; // let Tab leave the terminal when there is nothing to complete
      e.preventDefault();
      const { value, candidates } = engine.complete(input);
      setInput(value);
      if (candidates.length > 1) engine.print(candidates.join('   '), 'dim');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setInput(engine.historyPrev(input));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setInput(engine.historyNext());
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      engine.clear();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      engine.print(`${snap.prompt} ${input}^C`, 'input');
      setInput('');
    }
  }

  function focusInput() {
    if (window.getSelection()?.toString()) return; // let people copy output
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="term" ref={rootRef} data-booted={snap.booted ? '' : undefined}>
      <div className="term-screen" onClick={focusInput}>
        <div
          className="term-out"
          ref={outRef}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
        >
          {snap.lines.map((line) => (
            <LineView key={line.id} line={line} />
          ))}
        </div>
        <label className="term-prompt">
          <span className="term-ps1" aria-hidden="true">
            {snap.prompt}
          </span>
          <input
            ref={inputRef}
            className="term-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Terminal command"
            placeholder={snap.booted && snap.lines.length < 12 ? 'type help' : ''}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
          />
        </label>
      </div>
    </div>
  );
}
