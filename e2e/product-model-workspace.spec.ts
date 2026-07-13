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
  test('product-models hierarchy tab renders seeded spine (TOC + List)', async ({ page }) => {
    const failed = watchFor5xx(page);
    await login(page);
    await page.goto('/product-models');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    // TOC (default view) — a seeded segment row proves the product spine arrived.
    await expect(page.getByText('Personal Lines', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });

    // List view — the flat version sheet renders with seeded version rows.
    await page.getByRole('tab', { name: 'List' }).click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await expect(page.getByText('HO-3 Homeowners').first()).toBeVisible({ timeout: 30_000 });
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

  test('products lens compares LOB versions off the spine and the picker rescopes it', async ({
    page,
  }) => {
    const failed = watchFor5xx(page);
    await login(page);
    await page.goto('/portfolio?domain=products');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    // The three-column skeleton + a spine LOB arrived (default = a comparable one).
    await expect(page.getByText('Normalize', { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Greenfield', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Compare', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Board')).toBeVisible(); // the LOB select

    // Version picker: default LOB has 2+ versions; dropping one rescopes the
    // comparison (the side-by-side summary count changes).
    const summary = page.getByText(/side by side|its own decomposition/).first();
    const before = (await summary.textContent()) ?? '';
    const chips = page.getByRole('button', { name: /✓/ });
    const chipCount = await chips.count();
    expect(chipCount, 'expected a multi-version LOB as the default board').toBeGreaterThan(1);
    await chips.first().click();
    const after = (await summary.textContent()) ?? '';
    expect(after, 'version toggle did not rescope the comparison').not.toEqual(before);

    expect(failed, '5xx responses on /portfolio?domain=products').toEqual([]);
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
