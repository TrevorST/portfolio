import type { Command } from './types';

/**
 * Every file in ./commands registers itself: export a Command (or an array of
 * them) as default. Adding a command, or an easter egg, is adding a file.
 */
const modules = import.meta.glob<{ default: Command | readonly Command[] }>('./commands/*.ts', {
  eager: true,
});

export const commands: readonly Command[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith('.test.ts'))
  .flatMap(([, mod]) => (Array.isArray(mod.default) ? mod.default : [mod.default as Command]));
