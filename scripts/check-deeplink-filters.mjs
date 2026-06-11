// Verification: deep links land on the LIST view with the matching filter
// pre-applied — /overview?focus=<vs> narrows the VS sheet to that stream;
// /roles?role=<id> narrows the org sheet to that role (plus the drawer).
// Run: node scripts/check-deeplink-filters.mjs
import { chromium } from 'playwright';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
  await page.goto('http://localhost:5173/login');
  await page.locator('input').first().fill('kevin.hicks@capgemini.com');
  await page.locator('input[type=password]').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);

  const { vsId, vsName, roleId, roleName } = await page.evaluate(async () => {
    const token = localStorage.getItem('cascade.token');
    const h = { Authorization: `Bearer ${token}` };
    const tree = await fetch('/api/explorer/tree', { headers: h }).then((x) => x.json());
    const vs = tree.divisions[1].valueStreams[0];
    const org = await fetch('/api/explorer/org-table', { headers: h }).then((x) => x.json());
    const role = org.segments[0].divisions[0].departments[0].roles[0];
    return { vsId: vs.id, vsName: vs.name, roleId: role.id, roleName: role.name };
  });

  // ── VS deep link ──
  await page.goto(`http://localhost:5173/overview?focus=${vsId}`);
  await page.waitForTimeout(3000);
  const vsStrip = norm(await page.locator('text=/value streams ·/').first().innerText());
  const vsFilterBtn = norm(await page.locator('.card > div').first().locator('button').nth(2).innerText());
  console.log(`VS deep link (${vsName}): strip="${vsStrip}" | VS filter="${vsFilterBtn}"`);

  // ── Role deep link ──
  await page.goto(`http://localhost:5173/roles?role=${roleId}`);
  await page.waitForTimeout(3000);
  const drawerOpen = await page.locator('[role=dialog]').count();
  // close the drawer (backdrop click) to read the sheet behind it
  if (drawerOpen) await page.mouse.click(200, 500);
  await page.waitForTimeout(800);
  const orgStrip = norm(await page.locator('text=/domains ·/').first().innerText());
  console.log(`Role deep link (${roleName}): drawer=${drawerOpen > 0} | strip="${orgStrip}"`);
  await page.screenshot({ path: 'deeplink-org-filtered.png' });
  await browser.close();
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
