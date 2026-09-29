import type { Command, CommandContext, SiteEntry } from '../types';

function listing(ctx: CommandContext, heading: string, entries: readonly SiteEntry[]) {
  ctx.print(`// ${heading} // ${entries.length}`, 'accent');
  if (entries.length === 0) {
    ctx.print('nothing here yet.', 'dim');
    return;
  }
  const width = Math.max(...entries.map((e) => e.slug.length));
  for (const e of entries) {
    ctx.print(`  ${e.slug.padEnd(width)}  ${e.meta ?? ''}`.trimEnd());
  }
  ctx.print("'open <name>' to read one.", 'dim');
}

const projects: Command = {
  name: 'projects',
  summary: 'List projects',
  aliases: ['work'],
  run: (ctx) => listing(ctx, 'PROJECTS', ctx.data.projects),
};

const posts: Command = {
  name: 'posts',
  summary: 'List blog posts',
  aliases: ['blog'],
  run: (ctx) => listing(ctx, 'POSTS', ctx.data.posts),
};

export default [projects, posts];
