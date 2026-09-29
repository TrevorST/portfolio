import { buildTree, HOME, Vfs } from './vfs';
import type {
  Command,
  CommandContext,
  Line,
  LineKind,
  SiteData,
  Snapshot,
  TerminalHost,
} from './types';

export const MAX_LINES = 400;
const MAX_HISTORY = 100;

export interface EngineOptions {
  data: SiteData;
  commands: readonly Command[];
  host: TerminalHost;
}

/** Split a command line into words, honouring single and double quotes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
    }
  }
  if (has || cur) out.push(cur);
  return out;
}

export class TerminalEngine {
  readonly fs: Vfs;
  readonly data: SiteData;
  private readonly host: TerminalHost;
  private readonly registry = new Map<string, Command>();
  private readonly visible: Command[] = [];

  private lines: Line[] = [];
  private nextId = 1;
  private cwd = HOME;
  private busy = false;
  private bootQueued = false;
  private pending = 0;
  private tail: Promise<void> = Promise.resolve();
  private booted = false;
  private history: string[] = [];
  private historyCursor = 0;
  private draft = '';

  private snapshot: Snapshot;
  private readonly listeners = new Set<() => void>();

  constructor({ data, commands, host }: EngineOptions) {
    this.data = data;
    this.host = host;
    this.fs = new Vfs(buildTree(data));
    for (const cmd of commands) {
      for (const name of [cmd.name, ...(cmd.aliases ?? [])]) {
        if (this.registry.has(name)) throw new Error(`Duplicate terminal command: ${name}`);
        this.registry.set(name, cmd);
      }
      if (!cmd.hidden) this.visible.push(cmd);
    }
    this.visible.sort((a, b) => a.name.localeCompare(b.name));
    this.snapshot = this.makeSnapshot();
  }

  // ---- store protocol (fits React's useSyncExternalStore) ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  /** Commands shown in help and offered by completion. */
  get commands(): readonly Command[] {
    return this.visible;
  }

  private makeSnapshot(): Snapshot {
    return {
      lines: this.lines,
      cwd: this.cwd,
      prompt: `guest@trv:${this.fs.pretty(this.cwd)}$`,
      busy: this.busy,
      booted: this.booted,
    };
  }

  private emit(): void {
    this.snapshot = this.makeSnapshot();
    for (const l of this.listeners) l();
  }

  // ---- output ----

  print(text: string, kind: LineKind = 'output', href?: string): void {
    const add: Line[] = text
      .split('\n')
      .map((t) =>
        href === undefined
          ? { id: this.nextId++, kind, text: t }
          : { id: this.nextId++, kind, text: t, href },
      );
    const next = this.lines.concat(add);
    this.lines = next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    this.emit();
  }

  clear(): void {
    this.lines = [];
    this.emit();
  }

  // ---- boot ----

  /** Play the power-on log. `fast` skips the delays (reduced motion, revisits). */
  boot({ fast = false }: { fast?: boolean } = {}): Promise<void> {
    if (this.bootQueued) return this.tail;
    this.bootQueued = true;
    return this.enqueue(() => this.runBoot(fast));
  }

  private async runBoot(fast: boolean): Promise<void> {
    const wait = (ms: number) => (fast ? Promise.resolve() : this.host.sleep(ms));
    const { build, projects, posts } = this.data;
    const steps: [string, LineKind, number][] = [
      [`TRV.SYS ${build.version} // build ${build.commit}`, 'dim', 120],
      ['[ok] grid .............. online', 'output', 90],
      ['[ok] signal ............ #C6FF1A', 'output', 90],
      [`[ok] projects .......... ${projects.length} loaded`, 'output', 90],
      [`[ok] posts ............. ${posts.length} loaded`, 'output', 160],
      ['// READY //', 'accent', 60],
      ["Type 'help' to see what this machine can do.", 'system', 0],
    ];
    for (const [text, kind, ms] of steps) {
      this.print(text, kind);
      await wait(ms);
    }
    this.booted = true;
  }

  /**
   * Boot and commands run strictly one after another. Input typed while
   * something is still running (boot, a slow command) waits its turn instead
   * of being dropped.
   */
  private enqueue(task: () => Promise<void>): Promise<void> {
    this.pending += 1;
    this.busy = true;
    this.emit();
    const run = this.tail.then(task).finally(() => {
      this.pending -= 1;
      this.busy = this.pending > 0;
      this.emit();
    });
    // a failed task must not stall the queue
    this.tail = run.catch(() => {});
    return run;
  }

  // ---- history ----

  /** Step back through history. `current` is the unsent input, restored on the way down. */
  historyPrev(current: string): string {
    if (this.history.length === 0) return current;
    if (this.historyCursor === this.history.length) this.draft = current;
    this.historyCursor = Math.max(0, this.historyCursor - 1);
    return this.history[this.historyCursor] ?? current;
  }

  historyNext(): string {
    if (this.historyCursor >= this.history.length) return this.draft;
    this.historyCursor += 1;
    return this.historyCursor === this.history.length
      ? this.draft
      : (this.history[this.historyCursor] ?? '');
  }

  // ---- execution ----

  execute(raw: string): Promise<void> {
    const line = raw.trim();
    if (line) {
      // history updates immediately so Up works even while this is queued
      if (this.history.at(-1) !== line) this.history.push(line);
      if (this.history.length > MAX_HISTORY) this.history.shift();
      this.historyCursor = this.history.length;
      this.draft = '';
    }
    return this.enqueue(async () => {
      this.print(`${this.snapshot.prompt} ${raw}`, 'input');
      if (line) await this.dispatch(line);
    });
  }

  private async dispatch(line: string): Promise<void> {
    const [name = '', ...args] = tokenize(line);
    const cmd = this.registry.get(name.toLowerCase());
    try {
      this.host.onCommand?.(cmd?.name ?? 'unknown', { hidden: cmd?.hidden ?? false });
    } catch {
      /* observers must never break the terminal */
    }
    if (!cmd) {
      this.print(`${name}: command not found. Try 'help'.`, 'error');
      return;
    }
    try {
      await cmd.run(this.context(args, line));
    } catch (err) {
      this.print(`${name}: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  private context(args: readonly string[], raw: string): CommandContext {
    return {
      args,
      raw,
      data: this.data,
      fs: this.fs,
      cwd: this.cwd,
      history: this.history,
      commands: this.registry,
      host: this.host,
      print: (text, kind) => this.print(text, kind),
      link: (text, href) => this.print(text, 'accent', href),
      clear: () => this.clear(),
      setCwd: (path) => {
        this.cwd = path;
        this.emit();
      },
      exec: (next) => this.dispatch(next),
    };
  }

  // ---- completion ----

  /**
   * Complete the word under the cursor (the end of `input`). Returns the new
   * input and, when ambiguous, the candidates so the renderer can list them.
   */
  complete(input: string): { value: string; candidates: readonly string[] } {
    const words = tokenize(input);
    const endsWithSpace = /\s$/.test(input);
    const completingCommand = words.length === 0 || (words.length === 1 && !endsWithSpace);
    const partial = endsWithSpace ? '' : (words.at(-1) ?? '');

    let candidates: readonly string[];
    if (completingCommand) {
      candidates = this.visible
        .map((c) => c.name)
        .filter((n) => n.startsWith(partial.toLowerCase()));
    } else {
      const cmd = this.registry.get((words[0] ?? '').toLowerCase());
      const ctx = this.context(words.slice(1), input);
      candidates = cmd?.complete?.(partial, ctx) ?? [];
    }

    if (candidates.length === 0) return { value: input, candidates: [] };
    const base = input.slice(0, input.length - partial.length);
    if (candidates.length === 1) {
      const only = candidates[0] ?? '';
      return { value: base + only + (only.endsWith('/') ? '' : ' '), candidates: [] };
    }
    const prefix = commonPrefix(candidates);
    return { value: base + (prefix.length > partial.length ? prefix : partial), candidates };
  }
}

function commonPrefix(words: readonly string[]): string {
  let prefix = words[0] ?? '';
  for (const w of words) {
    while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
