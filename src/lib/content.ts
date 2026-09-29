import { getCollection, type CollectionEntry } from 'astro:content';
import { build, site } from '~/site.config';
import type { SiteData } from '~/terminal/types';

export type Project = CollectionEntry<'projects'>;
export type Post = CollectionEntry<'posts'>;
export type Job = CollectionEntry<'experience'>;

/** Drafts show in `astro dev` and never in a production build. */
const published = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', published);
  return all.sort(
    (a, b) =>
      a.data.order - b.data.order ||
      (b.data.year ?? 0) - (a.data.year ?? 0) ||
      a.data.title.localeCompare(b.data.title),
  );
}

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', published);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Newest first; the current role (end: present) always leads. */
export async function getExperience(): Promise<Job[]> {
  const all = await getCollection('experience');
  const endKey = (j: Job) => (j.data.end === 'present' ? '9999-99' : j.data.end);
  return all.sort(
    (a, b) => endKey(b).localeCompare(endKey(a)) || b.data.start.localeCompare(a.data.start),
  );
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** '2023-10' -> 'OCT 2023'. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${y}`;
}

/** 'OCT 2023 – PRESENT'. */
export function dateRange(start: string, end: string): string {
  return `${monthLabel(start)} – ${end === 'present' ? 'PRESENT' : monthLabel(end)}`;
}

export const projectUrl = (p: Project) => `/projects/${p.id}`;
export const postUrl = (p: Post) => `/blog/${p.id}`;

/** The one-line data point every project label carries (design principle P.02). */
export function projectMeta(p: Project): string {
  const parts = [
    p.data.build ? `BUILD ${p.data.build}` : p.data.year?.toString(),
    `STATUS ${p.data.status}`,
  ];
  return parts.filter(Boolean).join(' · ').toUpperCase();
}

/** ISO date, e.g. 2026-09-29. Dates in labels read as data, not prose. */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Everything the terminal needs, serialised into the page. Summaries only, no bodies. */
export async function terminalData(): Promise<SiteData> {
  const [projects, posts, jobs] = await Promise.all([getProjects(), getPosts(), getExperience()]);
  return {
    name: site.name,
    handle: site.handle,
    role: site.role,
    bio: site.bio,
    email: site.email,
    links: site.links,
    build,
    experience: jobs.map((j) => ({
      role: j.data.role,
      org: j.data.orgNote ? `${j.data.org} (${j.data.orgNote})` : j.data.org,
      location: j.data.location,
      dates: dateRange(j.data.start, j.data.end),
      summary: j.data.summary,
    })),
    education: site.education.map((e) => ({
      degree: e.degree,
      school: e.school,
      dates: dateRange(e.start, e.end),
    })),
    skills: site.skills.map((s) => ({ group: s.group, items: s.items })),
    projects: projects.map((p) => ({
      slug: p.id,
      title: p.data.title,
      summary: p.data.summary,
      url: projectUrl(p),
      tags: p.data.stack,
      meta: projectMeta(p),
    })),
    posts: posts.map((p) => ({
      slug: p.id,
      title: p.data.title,
      summary: p.data.summary,
      url: postUrl(p),
      tags: p.data.tags,
      meta: isoDate(p.data.date),
    })),
  };
}
