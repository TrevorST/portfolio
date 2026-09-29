import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Content is plain Markdown/MDX in src/content. Push a file, Vercel rebuilds,
 * it is live. Frontmatter is validated here, so a typo fails the build (and the
 * PR check) instead of breaking a page in production.
 */

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        /** One or two sentences. Shown on cards, in the terminal and as the meta description. */
        summary: z.string().max(240),
        /** Real version string when there is one, e.g. "0.2.0". Never invented. */
        build: z.string().optional(),
        status: z.enum(['live', 'active', 'shipped', 'archived']),
        year: z.number().int().min(2000).max(2100).optional(),
        stack: z.array(z.string()).default([]),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        links: z
          .object({
            repo: z.url().optional(),
            demo: z.string().optional(),
            live: z.url().optional(),
          })
          .default({}),
        featured: z.boolean().default(false),
        /** Lower sorts first. */
        order: z.number().default(100),
        draft: z.boolean().default(false),
      })
      .refine((p) => !p.cover || p.coverAlt, {
        error: 'coverAlt is required when cover is set',
        path: ['coverAlt'],
      }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(240),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, posts };
