import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  '/',
  '/about',
  '/projects',
  '/projects/circleflow',
  '/projects/xv6-doom',
  '/blog',
  '/blog/rebuilding-this-site',
];

/** Fail the test on any console error or uncaught exception. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

for (const path of PAGES) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page).toHaveTitle(/Trevor Taylor/);

    // no horizontal scroll at any viewport
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('non-production builds never load analytics', async ({ page }) => {
  const stats: string[] = [];
  page.on('request', (req) => {
    if (/\/stats\/|umami/.test(req.url())) stats.push(req.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('script[data-analytics]')).toHaveCount(0);
  expect(stats).toEqual([]);
});

test('unknown routes get the 404 page', async ({ page }) => {
  const res = await page.goto('/definitely-not-a-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lost');
});

test.describe('terminal', () => {
  test('boots and runs commands', async ({ page }) => {
    await page.goto('/#terminal');
    const log = page.getByRole('log', { name: 'Terminal output' });
    await expect(log).toContainText('// READY //');

    const input = page.getByRole('textbox', { name: 'Terminal command' });
    await input.fill('help');
    await input.press('Enter');
    await expect(log).toContainText('// COMMANDS //');

    await input.fill('ls pro');
    await input.press('Tab');
    await expect(input).toHaveValue('ls projects/');
    await input.press('Enter');
    await expect(log).toContainText('circleflow.md');
  });

  test('open navigates to a project page', async ({ page }) => {
    await page.goto('/#terminal');
    await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('READY');
    const input = page.getByRole('textbox', { name: 'Terminal command' });
    await input.fill('open circleflow');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/projects\/circleflow$/);
  });

  test('boots instantly under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/#terminal');
    await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('READY', {
      timeout: 1500,
    });
    await context.close();
  });
});

test('every project card links to a working page', async ({ page }) => {
  await page.goto('/projects');
  const hrefs = await page
    .locator('article h3 a')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await page.request.get(href!);
    expect(res.status(), href!).toBe(200);
  }
});
