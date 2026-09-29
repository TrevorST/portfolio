import { resumeLines } from './resume-text';
import type { SiteData, SiteEntry } from './types';

export interface FileNode {
  readonly type: 'file';
  readonly content: string;
  /** Page this file stands for. `open` navigates here. */
  readonly href?: string;
}

export interface DirNode {
  readonly type: 'dir';
  readonly children: ReadonlyMap<string, VfsNode>;
}

export type VfsNode = FileNode | DirNode;

export const HOME = '/home/trevor';

const file = (content: string, href?: string): FileNode =>
  href === undefined ? { type: 'file', content } : { type: 'file', content, href };

const dir = (entries: Record<string, VfsNode>): DirNode => ({
  type: 'dir',
  children: new Map(Object.entries(entries)),
});

function entryFile(entry: SiteEntry): FileNode {
  const lines = [
    `# ${entry.title}`,
    entry.meta ? `// ${entry.meta} //` : '',
    '',
    entry.summary,
    '',
    entry.tags.length ? `tags: ${entry.tags.join(', ')}` : '',
    `open: ${entry.url}`,
  ].filter((line, i, all) => line !== '' || (all[i - 1] ?? '') !== '');
  return file(lines.join('\n'), entry.url);
}

function entriesDir(entries: readonly SiteEntry[]): DirNode {
  return dir(Object.fromEntries(entries.map((e) => [`${e.slug}.md`, entryFile(e)])));
}

/** Build the file system the terminal browses from the site's real content. */
export function buildTree(data: SiteData): DirNode {
  const about = [data.name, data.role, '', data.bio].join('\n');
  const contact = [
    `email: ${data.email}`,
    ...data.links.map((l) => `${l.label.toLowerCase()}: ${l.href}`),
  ].join('\n');
  const home = dir({
    'about.txt': file(about, '/about'),
    'resume.txt': file(resumeLines(data).join('\n'), '/about'),
    'contact.txt': file(contact, '/#contact'),
    projects: entriesDir(data.projects),
    posts: entriesDir(data.posts),
    '.plan': file(
      'v0.2: a 3D computer you are standing in front of.\nv0.3: live demos.\nv0.4: polish, posts, secrets.\nv1.0: launch.',
    ),
  });
  return dir({ home: dir({ trevor: home }) });
}

export class Vfs {
  constructor(private readonly root: DirNode) {}

  /** Resolve `path` against `cwd` into a normalised absolute path. */
  resolve(path: string, cwd: string): string {
    let p = path.trim();
    if (p === '' || p === '~') return HOME;
    if (p.startsWith('~/')) p = HOME + p.slice(1);
    const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/');
    const out: string[] = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return `/${out.join('/')}`;
  }

  get(absPath: string): VfsNode | undefined {
    let node: VfsNode = this.root;
    for (const part of absPath.split('/').filter(Boolean)) {
      if (node.type !== 'dir') return undefined;
      const next: VfsNode | undefined = node.children.get(part);
      if (!next) return undefined;
      node = next;
    }
    return node;
  }

  /** Display form of an absolute path, with $HOME shortened to ~. */
  pretty(absPath: string): string {
    if (absPath === HOME) return '~';
    return absPath.startsWith(`${HOME}/`) ? `~${absPath.slice(HOME.length)}` : absPath;
  }

  /** Complete a partial path. Returns candidates in the same form the user typed. */
  complete(partial: string, cwd: string, filter?: (node: VfsNode) => boolean): string[] {
    const slash = partial.lastIndexOf('/');
    const head = slash === -1 ? '' : partial.slice(0, slash + 1);
    const tail = slash === -1 ? partial : partial.slice(slash + 1);
    const parent = this.get(this.resolve(head || '.', cwd));
    if (!parent || parent.type !== 'dir') return [];
    const showHidden = tail.startsWith('.');
    return [...parent.children.entries()]
      .filter(([name]) => name.startsWith(tail) && (showHidden || !name.startsWith('.')))
      .filter(([, node]) => !filter || filter(node))
      .map(([name, node]) => head + name + (node.type === 'dir' ? '/' : ''))
      .sort();
  }
}
