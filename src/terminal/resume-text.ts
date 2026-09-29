import type { SiteData } from './types';

/** Plain-text resume. Shared by the `resume` command and ~/resume.txt. */
export function resumeLines(data: SiteData): string[] {
  const lines: string[] = ['// EXPERIENCE //'];
  for (const job of data.experience) {
    lines.push(
      job.dates,
      `  ${job.role}`,
      `  ${job.org} · ${job.location}`,
      `  ${job.summary}`,
      '',
    );
  }
  lines.push('// EDUCATION //');
  for (const e of data.education) lines.push(e.dates, `  ${e.degree}`, `  ${e.school}`, '');
  lines.push('// SKILLS //');
  const width = Math.max(...data.skills.map((s) => s.group.length));
  for (const s of data.skills) {
    lines.push(`  ${s.group.toLowerCase().padEnd(width)}  ${s.items.join(', ')}`);
  }
  return lines;
}
