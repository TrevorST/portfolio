/**
 * The terminal is split in two:
 *
 * - the ENGINE (this folder) owns state: output lines, cwd, history, the virtual
 *   file system and command dispatch. It has no DOM and no React, so the same
 *   engine can drive the flat terminal (v0.1) and the 3D CRT screen (v0.2).
 * - a RENDERER subscribes to snapshots and forwards keystrokes. It owns only
 *   the text currently being typed.
 */

export type LineKind = 'input' | 'output' | 'error' | 'system' | 'accent' | 'dim';

export interface Line {
  readonly id: number;
  readonly kind: LineKind;
  readonly text: string;
  /** When set, renderers present the line as a link. */
  readonly href?: string;
}

/** A content entry the terminal can list, read and open. */
export interface SiteEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly url: string;
  readonly tags: readonly string[];
  /** Short label such as a build tag, status or date. */
  readonly meta?: string;
}

export interface SiteLink {
  readonly label: string;
  readonly href: string;
}

export interface SiteJob {
  readonly role: string;
  readonly org: string;
  readonly location: string;
  /** Display range, e.g. "OCT 2023 – PRESENT". */
  readonly dates: string;
  readonly summary: string;
}

export interface SiteEducation {
  readonly degree: string;
  readonly school: string;
  readonly dates: string;
}

export interface SiteData {
  readonly name: string;
  readonly handle: string;
  readonly role: string;
  readonly bio: string;
  readonly email: string;
  readonly links: readonly SiteLink[];
  readonly projects: readonly SiteEntry[];
  readonly posts: readonly SiteEntry[];
  readonly experience: readonly SiteJob[];
  readonly education: readonly SiteEducation[];
  readonly skills: readonly { readonly group: string; readonly items: readonly string[] }[];
  readonly build: { readonly version: string; readonly commit: string; readonly date: string };
}

/** Side effects the engine cannot perform itself. Supplied by the renderer. */
export interface TerminalHost {
  navigate(href: string): void;
  sleep(ms: number): Promise<void>;
  now(): Date;
  /**
   * Called once per command line with the canonical command name ('unknown'
   * when nothing matched). Never receives the arguments or the raw input.
   */
  onCommand?(name: string, info: { hidden: boolean }): void;
}

export interface Snapshot {
  readonly lines: readonly Line[];
  readonly cwd: string;
  readonly prompt: string;
  readonly busy: boolean;
  readonly booted: boolean;
}

export interface CommandContext {
  readonly args: readonly string[];
  readonly raw: string;
  readonly data: SiteData;
  readonly fs: import('./vfs').Vfs;
  readonly cwd: string;
  readonly history: readonly string[];
  readonly commands: ReadonlyMap<string, Command>;
  readonly host: TerminalHost;
  print(text: string, kind?: LineKind): void;
  link(text: string, href: string): void;
  clear(): void;
  setCwd(path: string): void;
  /** Run another command line as if typed (without echoing it). */
  exec(line: string): Promise<void>;
}

export interface Command {
  readonly name: string;
  readonly summary: string;
  readonly usage?: string;
  readonly aliases?: readonly string[];
  /** Hidden commands run but never appear in `help` or tab completion. */
  readonly hidden?: boolean;
  run(ctx: CommandContext): void | Promise<void>;
  /** Completion candidates for the argument currently being typed. */
  complete?(partial: string, ctx: CommandContext): readonly string[];
}
