// Reproduce a true client-side click path: org list → role drawer → click a
// value-stream participation link → VS list must arrive filtered to that stream.
// Then: StandardArea-style direct SPA pushState for a role.
// Run: node scripts/check-deeplink-clicks.mjs
import { chromium } from 'playwright';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:5173/login');
  await page.locator('input').first().fill('kevin.hicks@capgemini.com');
  await page.locator('input[type=password]').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  // org list → open a role drawer
  await page.goto('http://localhost:5173/roles');
  await page.waitForTimeout(2500);
  await page.locator('.card .rounded-b-lg > div').filter({ hasText: 'Claims Adjuster' }).first()
    .locator('> div').last().click();
  await page.waitForTimeout(2500);
  const vsLink = page.locator('[role=dialog] a[href^="/overview?focus="]').first();
  const vsName = norm(await vsLink.innerText());
  await vsLink.click(); // client-side navigation to the VS tab
  await page.waitForTimeout(3500);
  console.log('URL after VS link click:', page.url());
  const strip = await page.locator('text=/value streams ·/').first().innerText().catch(() => 'NO STRIP');
  console.log(`clicked VS "${vsName}" → strip="${norm(String(strip))}"`);
  // read all header combobox values
  const headerBtns = await page.locator('.card > div').first().locator('button').allInnerTexts();
  console.log('header controls:', headerBtns.map(norm).filter(Boolean).join(' / '));
  await page.screenshot({ path: 'click-vs-filter.png' });
  await browser.close();
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
