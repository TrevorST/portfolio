import type { Command } from '../types';

/** Carried over from the 2023 site's terminal. */
const fib: Command = {
  name: 'fib',
  summary: 'First n Fibonacci numbers',
  usage: 'fib <n>',
  run({ args, print }) {
    const n = Number(args[0]);
    if (!Number.isInteger(n) || n < 1 || n > 90)
      throw new Error('give me a whole number from 1 to 90');
    const out: bigint[] = [];
    let [a, b] = [0n, 1n];
    for (let i = 0; i < n; i++) {
      out.push(a);
      [a, b] = [b, a + b];
    }
    print(out.join(', '));
  },
};

const sudo: Command = {
  name: 'sudo',
  summary: 'No.',
  hidden: true,
  run({ print }) {
    print('guest is not in the sudoers file. This incident will be reported.', 'error');
  },
};

export default [fib, sudo];
