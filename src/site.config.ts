/** Identity and navigation. Edit here; every page and the terminal read from it. */
export const site = {
  name: 'Trevor Taylor',
  handle: 'trevor',
  role: 'Software engineer / builder',
  description:
    'Trevor Taylor, software engineer. Tools for making things: a circle-geometry logo editor, an AI prototyping studio, and the agent pipelines that ship them.',
  bio: 'Software engineer with a B.S. in Computer Science from East Tennessee State University. I build tools for making things, and the automated pipelines that test and ship them.',
  email: 'trevorst18@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/TrevorST' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/trevor-taylor-46b353264' },
  ],
  nav: [
    { label: 'Work', href: '/projects' },
    { label: 'Writing', href: '/blog' },
    { label: 'Terminal', href: '/#terminal' },
    { label: 'Contact', href: '/#contact' },
  ],
} as const;

export const build = __BUILD__;
