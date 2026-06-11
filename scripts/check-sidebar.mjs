// Throwaway verification for the two reported bugs:
//  1. VS list: clicking a row should show the metrics sidebar EXPANDED.
//  2. Org map: a ?role= deep link must keep the map view (drawer overlays it).
// Run: node scripts/check-sidebar.mjs
import { chromium } from 'playwright';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.goto('http://localhost:5173/login');
  await page.locator('input').first().fill('kevin.hicks@capgemini.com');
  await page.locator('input[type=password]').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  // ── 1. VS list sidebar expands on click ──
  await page.goto('http://localhost:5173/overview');
  await page.waitForTimeout(1500);
  const listBtn = page.getByRole('button', { name: 'List', exact: true });
  if (await listBtn.count()) await listBtn.first().click();
  await page.waitForTimeout(2500);
  await page.locator('.card .rounded-b-lg > div').first().click();
  await page.waitForTimeout(2000);
  const box = await page.locator('aside').first().boundingBox();
  console.log('VS list sidebar width after click:', box?.width, box && box.width > 300 ? 'EXPANDED ✓' : 'collapsed ✗');
  await page.screenshot({ path: 'vs-sidebar-expanded.png' });

  // ── 2. Org map + role deep link stays on map ──
  await page.goto('http://localhost:5173/roles');
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: 'Map' }).first().click();
  await page.waitForTimeout(2500);
  // simulate a role leaf click: navigate with ?role= like OrgMapCanvas does
  const roleId = await page.evaluate(async () => {
    const token = localStorage.getItem('cascade.token');
    const r = await fetch('/api/explorer/org-table', { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json());
    return r.segments[0].divisions[0].departments[0].roles[0].id;
  });
  await page.evaluate((id) => { window.history.pushState({}, '', `/roles?role=${id}`); window.dispatchEvent(new PopStateEvent('popstate')); }, roleId);
  await page.waitForTimeout(2500);
  const mapStillActive = await page.getByRole('tab', { name: 'Map' }).getAttribute('aria-selected');
  const drawerOpen = await page.locator('[role=dialog]').count();
  console.log('after ?role= deep link — Map tab selected:', mapStillActive, '| drawer open:', drawerOpen > 0);
  await page.screenshot({ path: 'org-map-role-drawer.png' });

  await browser.close();
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
