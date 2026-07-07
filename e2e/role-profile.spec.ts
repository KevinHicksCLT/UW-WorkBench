import { test, expect, type Page } from '@playwright/test';

/**
 * Role profile smoke — from the Roles List view, follow the first role link to
 * /roles/:id and assert the profile page renders its sections. No hardcoded
 * role ids: the link click resolves whatever the seed produced.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'kevin.hicks@capgemini.com');
  await page.fill('input[type="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.describe('role profile', () => {
  test('roles list → role link → profile page with sections', async ({ page }) => {
    await login(page);
    await page.goto('/roles?view=list');
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    // The Role column renders each name as a link to /roles/:id.
    const roleLink = page.locator('a[href^="/roles/"]').first();
    await expect(roleLink).toBeVisible({ timeout: 60_000 });
    const roleName = (await roleLink.textContent())?.trim() ?? '';
    await roleLink.click();

    await page.waitForURL(/\/roles\/[^/]+$/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});

    if (roleName) {
      await expect(page.getByRole('heading', { name: roleName })).toBeVisible();
    }
    await expect(page.getByText('Job description')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Value Streams' })).toBeVisible();
    await expect(page.getByText('Deliverables').first()).toBeVisible();
    await expect(page.getByText('Task Summary')).toBeVisible();
  });
});
