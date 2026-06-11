// Verification: VS list Domain/Division cells must NOT open the sidebar;
// the Value stream cell still must. Run: node scripts/check-dead-cells.mjs
import { chromium } from 'playwright';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  await page.goto('http://localhost:5173/login');
  await page.locator('input').first().fill('kevin.hicks@capgemini.com');
  await page.locator('input[type=password]').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:5173/overview');
  await page.waitForTimeout(1500);
  const listBtn = page.getByRole('button', { name: 'List', exact: true });
  if (await listBtn.count()) await listBtn.first().click();
  await page.waitForTimeout(2500);

  const row = page.locator('.card .rounded-b-lg > div').first();
  await row.locator('> div').nth(0).click(); // Domain cell
  await page.waitForTimeout(1200);
  const afterDomain = await page.locator('aside').count();
  await row.locator('> div').nth(1).click(); // Division cell
  await page.waitForTimeout(1200);
  const afterDivision = await page.locator('aside').count();
  await row.locator('> div').nth(2).click(); // Value stream cell
  await page.waitForTimeout(1500);
  const afterVs = await page.locator('aside').count();
  console.log('sidebar after Domain click:', afterDomain, '| after Division click:', afterDivision, '| after VS click:', afterVs);
  await browser.close();
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
