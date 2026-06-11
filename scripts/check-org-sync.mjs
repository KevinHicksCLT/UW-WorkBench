// Verification: org list & map sidebars must be IDENTICAL per level.
//  - list: click Division cell → expanded MetricsSidebar with domain accent
//  - map: drill segment → division → same MetricsSidebar content
//  - role: list row click AND map role leaf both open the RoleDrawer
// Run: node scripts/check-org-sync.mjs
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

  // ── LIST: division sidebar ──
  await page.goto('http://localhost:5173/roles');
  await page.waitForTimeout(2500);
  await page.locator('.card .rounded-b-lg > div').filter({ hasText: 'Claims' }).first()
    .locator('div').nth(1).click(); // Division cell
  await page.waitForTimeout(2500);
  const listAside = await page.locator('aside').first();
  const listText = norm(await listAside.innerText());
  const listBorder = await listAside.evaluate((el) => getComputedStyle(el).borderTopColor);
  console.log('LIST division sidebar header:', listText.slice(0, 90));
  console.log('LIST sidebar top border (accent):', listBorder);
  await page.screenshot({ path: 'org-list-division-sidebar.png' });

  // role click in list → drawer (click the Role cell itself — the last column)
  await page.locator('.card .rounded-b-lg > div').filter({ hasText: 'Claims Adjuster' }).first()
    .locator('> div').last().click();
  await page.waitForTimeout(2000);
  const listDrawer = await page.locator('[role=dialog]').count();
  const listDrawerText = listDrawer ? norm(await page.locator('[role=dialog]').innerText()) : '';
  console.log('LIST role click → drawer open:', listDrawer > 0, '| has sections:',
    ['Value-Stream Participation', 'Users in Role', 'Inputs', 'Responsibilities'].every((s) => listDrawerText.includes(s)));
  await page.screenshot({ path: 'org-list-role-drawer.png' });
  await page.keyboard.press('Escape');
  await page.locator('[role=dialog] >> css=div').first().click().catch(() => {}); // backdrop click closes
  await page.waitForTimeout(800);

  // ── MAP: same division via drill ──
  await page.goto('http://localhost:5173/roles');
  await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: 'Map' }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.react-flow__node', { hasText: 'Core business' }).first().click();
  await page.waitForTimeout(2500);
  const segAside = norm(await page.locator('aside').first().innerText());
  console.log('MAP segment sidebar header:', segAside.slice(0, 80));
  await page.locator('.react-flow__node', { hasText: 'Claims' }).first().click();
  await page.waitForTimeout(2500);
  const mapAside = await page.locator('aside').first();
  const mapText = norm(await mapAside.innerText());
  const mapBorder = await mapAside.evaluate((el) => getComputedStyle(el).borderTopColor);
  console.log('MAP division sidebar header:', mapText.slice(0, 90));
  console.log('MAP sidebar top border (accent):', mapBorder);
  console.log('LIST ↔ MAP division sidebar IDENTICAL:', listText === mapText);
  await page.screenshot({ path: 'org-map-division-sidebar.png' });

  await browser.close();
};
run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
