import { resumeLines } from '../resume-text';
import type { Command } from '../types';

const resume: Command = {
  name: 'resume',
  summary: 'Experience, education and skills',
  aliases: ['cv', 'experience'],
  run({ data, print, link }) {
    for (const line of resumeLines(data)) {
      print(line, line.startsWith('//') ? 'accent' : line.startsWith('  ') ? 'output' : 'dim');
    }
    link('full page: /about', '/about');
  },
};

export default resume;
