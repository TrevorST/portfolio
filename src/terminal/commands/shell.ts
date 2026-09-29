import type { Command } from '../types';

const clear: Command = {
  name: 'clear',
  summary: 'Clear the screen',
  aliases: ['cls'],
  run: ({ clear }) => clear(),
};

const echo: Command = {
  name: 'echo',
  summary: 'Repeat text back',
  usage: 'echo <text>',
  run: ({ args, print }) => print(args.join(' ')),
};

const history: Command = {
  name: 'history',
  summary: 'Show what you have typed',
  run({ history, print }) {
    history.forEach((line, i) => print(`${String(i + 1).padStart(4)}  ${line}`));
  },
};

const date: Command = {
  name: 'date',
  summary: 'Print the date and time (UTC)',
  run: ({ host, print }) => print(host.now().toUTCString()),
};

const version: Command = {
  name: 'version',
  summary: 'Build tag, commit and build date',
  aliases: ['uname'],
  run({ data, print }) {
    const { version, commit, date } = data.build;
    print(`TRV.SYS ${version}`, 'accent');
    print(`commit  ${commit}`);
    print(`built   ${date}`);
  },
};

export default [clear, echo, history, date, version];
