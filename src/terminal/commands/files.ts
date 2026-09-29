import type { Command } from '../types';
import type { VfsNode } from '../vfs';

const isDir = (n: VfsNode) => n.type === 'dir';

const ls: Command = {
  name: 'ls',
  summary: 'List a directory. -a shows hidden files',
  usage: 'ls [-a] [path]',
  aliases: ['dir'],
  run({ args, fs, cwd, print }) {
    const all = args.includes('-a') || args.includes('-la');
    const target = args.find((a) => !a.startsWith('-')) ?? '.';
    const path = fs.resolve(target, cwd);
    const node = fs.get(path);
    if (!node) throw new Error(`cannot access '${target}': no such file or directory`);
    if (node.type === 'file') {
      print(target);
      return;
    }
    const names = [...node.children.entries()]
      .filter(([name]) => all || !name.startsWith('.'))
      .map(([name, child]) => (child.type === 'dir' ? `${name}/` : name))
      .sort();
    if (names.length === 0) return;
    for (const name of names) print(name, name.endsWith('/') ? 'accent' : 'output');
  },
  complete: (partial, { fs, cwd }) => fs.complete(partial, cwd),
};

const cd: Command = {
  name: 'cd',
  summary: 'Change directory',
  usage: 'cd [path]',
  run({ args, fs, cwd, setCwd }) {
    const target = args[0] ?? '~';
    const path = fs.resolve(target, cwd);
    const node = fs.get(path);
    if (!node) throw new Error(`${target}: no such file or directory`);
    if (node.type !== 'dir') throw new Error(`${target}: not a directory`);
    setCwd(path);
  },
  complete: (partial, { fs, cwd }) => fs.complete(partial, cwd, isDir),
};

const pwd: Command = {
  name: 'pwd',
  summary: 'Print the working directory',
  run({ cwd, print }) {
    print(cwd);
  },
};

const cat: Command = {
  name: 'cat',
  summary: 'Print a file',
  usage: 'cat <file>',
  aliases: ['less', 'more'],
  run({ args, fs, cwd, print }) {
    if (args.length === 0) throw new Error('missing file operand');
    for (const target of args) {
      const node = fs.get(fs.resolve(target, cwd));
      if (!node) throw new Error(`${target}: no such file or directory`);
      if (node.type === 'dir') throw new Error(`${target}: is a directory`);
      print(node.content);
    }
  },
  complete: (partial, { fs, cwd }) => fs.complete(partial, cwd),
};

const open: Command = {
  name: 'open',
  summary: 'Open a project, post or page in the browser',
  usage: 'open <file | project | post>',
  run({ args, fs, cwd, data, print, host }) {
    const target = args[0];
    if (!target) throw new Error("what should I open? Try 'open projects/' then Tab");
    const node = fs.get(fs.resolve(target, cwd));
    let href = node?.type === 'file' ? node.href : undefined;
    if (!href) {
      const slug = target.replace(/\.md$/, '').split('/').pop() ?? target;
      href = [...data.projects, ...data.posts].find((e) => e.slug === slug)?.url;
    }
    if (!href) throw new Error(`${target}: nothing to open`);
    print(`opening ${href} ...`, 'dim');
    host.navigate(href);
  },
  complete: (partial, { fs, cwd, data }) => {
    const paths = fs.complete(partial, cwd);
    const slugs = [...data.projects, ...data.posts]
      .map((e) => e.slug)
      .filter((s) => s.startsWith(partial));
    return [...new Set([...paths, ...slugs])].sort();
  },
};

export default [ls, cd, pwd, cat, open];
