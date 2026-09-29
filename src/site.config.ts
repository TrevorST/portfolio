/**
 * Identity, education, skills and navigation. Edit here; every page and the
 * terminal read from it. Jobs live in src/content/experience.
 */
export const site = {
  name: 'Trevor Taylor',
  handle: 'trevor',
  role: 'Software engineer / platform',
  description:
    'Trevor Taylor, software engineer at Toyota Motor North America. CI/CD platforms and database engineering at work; editors, simulations and a Doom port on my own time.',
  bio: 'Software engineer at Toyota Motor North America, building the Internal Developer Platform: CI/CD for 100+ applications across ~50 teams, and the database migration framework under it. Greenfield to production went from ~60 days to under 3 hours. Before that, full-stack at UNIFYI.',
  email: 'trevorst18@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/TrevorST' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/trevor-taylor-46b353264' },
  ],
  nav: [
    { label: 'Work', href: '/projects' },
    { label: 'About', href: '/about' },
    { label: 'Writing', href: '/blog' },
    { label: 'Terminal', href: '/#terminal' },
    { label: 'Contact', href: '/#contact' },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      school: 'East Tennessee State University',
      location: 'Johnson City, TN',
      start: '2018-08',
      end: '2023-08',
    },
  ],
  skills: [
    {
      group: 'Languages',
      items: [
        'Java',
        'C#',
        'Python',
        'JavaScript / TypeScript',
        'C / C++',
        'SQL (Postgres)',
        'HTML / CSS',
        'R',
      ],
    },
    {
      group: 'Frameworks',
      items: [
        'Spring Boot',
        'J2EE',
        'Angular',
        'React',
        'Node.js',
        'Express',
        'Flask',
        'Django',
        '.NET Core',
        'PrimeNG',
        'TailwindCSS',
        'JUnit',
      ],
    },
    { group: 'Cloud', items: ['AWS', 'Azure Synapse', 'Databricks'] },
    {
      group: 'Tools',
      items: [
        'Git',
        'GitHub',
        'GitLab CI/CD',
        'Docker',
        'Google Cloud Platform',
        'VS Code',
        'Visual Studio',
      ],
    },
  ],
} as const;

/**
 * Umami analytics. Both values are public (they ship in the page), not
 * secrets. Leave `websiteId` empty to disable. The script only loads on
 * Vercel production builds, never on previews or locally, and is proxied
 * through /stats (see vercel.json) so it is first-party.
 */
export const analytics = {
  websiteId: 'cce5732d-0f50-4ec3-a36b-22150d45f1c0',
  /** Umami Cloud. Must match the rewrite destinations in vercel.json. */
  host: 'https://cloud.umami.is',
};

export const build = __BUILD__;
