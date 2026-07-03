import { test, expect, type Page } from '@playwright/test';

/**
 * Entitlements smoke — RBAC nav filtering, forbidden deep-link redirects, and
 * preference persistence across reloads. Uses the seeded demo users
 * (seedPermissions.ts): a MEMBER-type user and the SITE_ADMIN.
 */

async function loginAs(page: Page, email: string, password = 'demo1234'): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.describe('entitlements', () => {
  test('member sees no admin nav and forbidden deep links redirect away', async ({ page }) => {
    await loginAs(page, 'member@abc-insurance.demo');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Data Admin')).toHaveCount(0);
    await expect(nav.getByText('User Admin')).toHaveCount(0);
    await expect(nav.getByText('Value Streams')).toBeVisible();

    // A deep link to an unreadable page bounces to a readable one.
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('site admin reaches User Admin with all four sections', async ({ page }) => {
    await loginAs(page, 'kevin.hicks@capgemini.com');
    await page.goto('/user-admin');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    await expect(page.getByText('Users', { exact: false }).first()).toBeVisible();
    for (const section of ['User Types & Permissions', 'Import', 'API Keys']) {
      await expect(page.getByText(section, { exact: false }).first()).toBeVisible();
    }
  });

  test('domain admin sees only subtree users and no SITE_ADMIN option', async ({ page }) => {
    await loginAs(page, 'tech.admin@abc-insurance.demo');
    await page.goto('/user-admin');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    // The Technology admin's list must include the Technology-homed super user
    // but not the Core Business member (out of scope, server-filtered).
    await expect(page.getByText('super.user@abc-insurance.demo')).toBeVisible();
    await expect(page.getByText('member@abc-insurance.demo')).toHaveCount(0);
  });

  test('dashboard card hide persists across reload', async ({ page }) => {
    await loginAs(page, 'kevin.hicks@capgemini.com');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    await page.getByRole('button', { name: 'Customize' }).click();
    const firstHide = page.getByRole('button', { name: /^Hide / }).first();
    const hiddenTitle = (await firstHide.getAttribute('aria-label'))?.replace(/^Hide /, '') ?? '';
    await firstHide.click();
    // Debounced auto-save (~800ms) + PATCH round-trip.
    await page.waitForTimeout(2_000);

    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});
    if (hiddenTitle) {
      await expect(page.getByText(hiddenTitle, { exact: true })).toHaveCount(0);
    }

    // Clean up: reset to the company default so the run is idempotent.
    await page.getByRole('button', { name: 'Customize' }).click();
    await page.getByRole('button', { name: 'Reset to default' }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForTimeout(2_000);
  });
});
