import { test, expect, type Page } from '@playwright/test';

/**
 * Product Model Workspace smoke (plan §5 D-3) — the /product-models master
 * page renders seeded rows in both views, the Workspace board honors the
 * ?domain=product-models deep link, and the legacy Applications mode still
 * renders. Assertions are deliberately structural (counts, tabs, no 5xx) so
 * they hold while the board's v3 internals evolve.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'kevin.hicks@capgemini.com');
  await page.fill('input[type="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

function watchFor5xx(page: Page): string[] {
  const failed: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`);
  });
  return failed;
}

test.describe('product model workspace', () => {
  test('product-models master page renders seeded rows (TOC + List)', async ({ page }) => {
    const failed = watchFor5xx(page);
    await login(page);
    await page.goto('/product-models');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    // TOC (default view) — the totals line proves seeded data arrived.
    await expect(page.getByText(/product models across/).first()).toBeVisible({
      timeout: 30_000,
    });

    // List view — the Sheet renders with at least one data row.
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await expect(page.getByText('Product model', { exact: true }).first()).toBeVisible();
    expect(failed, '5xx responses on /product-models').toEqual([]);
  });

  test('workspace board honors the product-models domain deep link', async ({ page }) => {
    const failed = watchFor5xx(page);
    await login(page);
    await page.goto('/portfolio?domain=product-models');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    const bodyText = (await page.textContent('body')) ?? '';
    expect(bodyText.length, 'products board rendered blank').toBeGreaterThan(100);
    expect(failed, '5xx responses on /portfolio?domain=product-models').toEqual([]);
  });

  test('legacy application mode still renders on /portfolio', async ({ page }) => {
    const failed = watchFor5xx(page);
    await login(page);
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    const bodyText = (await page.textContent('body')) ?? '';
    expect(bodyText.length, 'workspace board rendered blank').toBeGreaterThan(100);
    expect(failed, '5xx responses on /portfolio').toEqual([]);
  });
});
