import type { Command } from '../types';

const help: Command = {
  name: 'help',
  summary: 'List commands, or explain one: help <command>',
  usage: 'help [command]',
  aliases: ['?'],
  run({ args, commands, print }) {
    const topic = args[0]?.toLowerCase();
    if (topic) {
      const cmd = commands.get(topic);
      if (!cmd || cmd.hidden) {
        print(`help: no such command '${topic}'`, 'error');
        return;
      }
      print(cmd.usage ?? cmd.name, 'accent');
      print(cmd.summary);
      if (cmd.aliases?.length) print(`aliases: ${cmd.aliases.join(', ')}`, 'dim');
      return;
    }
    const seen = new Set<Command>();
    const visible = [...commands.values()]
      .filter((c) => !c.hidden && !seen.has(c) && seen.add(c))
      .sort((a, b) => a.name.localeCompare(b.name));
    const width = Math.max(...visible.map((c) => c.name.length));
    print('// COMMANDS //', 'accent');
    for (const c of visible) print(`  ${c.name.padEnd(width)}  ${c.summary}`);
    print('Tab completes. Up/Down walks history. Some commands are not listed.', 'dim');
  },
  complete(partial, { commands }) {
    return [...new Set([...commands.values()].filter((c) => !c.hidden).map((c) => c.name))].filter(
      (n) => n.startsWith(partial),
    );
  },
};

export default help;
