import type { Command } from '../types';

const whoami: Command = {
  name: 'whoami',
  summary: 'Who built this machine',
  aliases: ['about'],
  run({ data, print }) {
    print(data.name.toUpperCase(), 'accent');
    print(data.role, 'dim');
    print(data.bio);
  },
};

const contact: Command = {
  name: 'contact',
  summary: 'How to reach me',
  aliases: ['email', 'social'],
  run({ data, print, link }) {
    print('// CONTACT //', 'accent');
    link(`email     ${data.email}`, `mailto:${data.email}`);
    for (const l of data.links) link(`${l.label.toLowerCase().padEnd(9)} ${l.href}`, l.href);
  },
};

export default [whoami, contact];
