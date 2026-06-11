import { chromium } from 'playwright';
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
await page.goto('http://localhost:5173/login');
await page.locator('input').first().fill('kevin.hicks@capgemini.com');
await page.locator('input[type=password]').fill('demo1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(2000);
// VS list -> click a VS cell -> expand sidebar -> View full details -> role chip
await page.goto('http://localhost:5173/overview');
await page.waitForTimeout(2500);
await page.locator('.card .rounded-b-lg > div').first().locator('> div').nth(2).click();
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'View full details' }).click();
await page.waitForTimeout(2000);
const chip = page.locator('a[href^="/roles?role="]').first();
const roleName = norm(await chip.innerText());
await chip.click();
await page.waitForTimeout(3000);
const drawer = await page.locator('[role=dialog]').count();
if (drawer) { await page.mouse.click(200, 500); await page.waitForTimeout(800); }
const strip = norm(await page.locator('text=/domains ·/').first().innerText().catch(() => 'NO STRIP'));
const headers = (await page.locator('.card > div').first().locator('button').allInnerTexts()).map(norm).filter(Boolean);
console.log(`role chip "${roleName}" -> drawer=${drawer > 0} | strip="${strip}" | headers: ${headers.join(' / ')}`);
await browser.close();
