// Verifies that every Data Admin entity's reported `total` equals the DB row
// count for the active company. Part of defect-fixes_01 task #3 (Data Admin ↔ DB
// fidelity). Read-only: only GETs against the local backend.
const BASE = 'http://localhost:4000';
const CID = 'cmpzuwu2900045mhswa9k8j3y'; // Meridian Insurance Group (only company)

// DB census (per-company == table count, single company). Pulled via SQL.
const CENSUS = {
  company: 1, valueStreamDomain: 6, division: 14, department: 97, role: 249,
  category: 40, checklistItem: 4744, roleTask: 4743, roleValueStream: 404,
  processStep: 711, ioItem: 835, application: 35, applicationValueStream: 63,
  metric: 267, standard: 13, standardItem: 408, person: 743, assignment: 743,
  personTask: 3340, personMetric: 17832, personAppUsage: 2972, personSignal: 22290,
  initiative: 6, initiativeValueStream: 9, initiativeDivision: 6, risk: 37,
  // deliverable/task/program/workstream/portfolioInitiative reconciled after the
  // 20260609000000_add_company_cascade_fks orphan cleanup (was 882/10908/12/20/20).
  scenario: 6, deliverable: 441, task: 5454, program: 3, workstream: 5,
  portfolioInitiative: 5, externalInteraction: 27,
  // Tree handlers (full node counts) + app-rationalization tables.
  organization: 364, valueStreams: 338, rationalizationWorkspace: 6,
  rationalizationApp: 12, rationalizationComponent: 30, rationalizationCapability: 128,
  rationalizationMicroservice: 30, rationalizationPlanStep: 0,
  // Transitively-scoped line items now editable in admin (A3), scoped via initiative→company.
  benefitLine: 9, costLine: 10, milestone: 15, raidItem: 11,
};

const login = async () => {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kevin.hicks@capgemini.com', password: 'demo1234' }),
  });
  return (await r.json()).token;
};

const run = async () => {
  const token = await login();
  const H = { Authorization: `Bearer ${token}` };
  const meta = await (await fetch(`${BASE}/admin/_meta`, { headers: H })).json();
  const rows = [];
  for (const e of meta.entities) {
    const url = `${BASE}/admin/${e.slug}?companyId=${CID}&limit=1`;
    let total = null, note = '';
    try {
      const res = await fetch(url, { headers: H });
      if (!res.ok) { note = `HTTP ${res.status}`; }
      else {
        const body = await res.json();
        total = Array.isArray(body) ? body.length
              : (body.total ?? (Array.isArray(body.rows) ? body.rows.length : null));
        if (body.total == null && !Array.isArray(body)) note = 'no .total field';
      }
    } catch (err) { note = String(err.message || err); }
    const expected = CENSUS[e.slug];
    const status = note ? '⚠ ' + note
      : expected == null ? '? no-census'
      : total === expected ? 'OK'
      : `MISMATCH db=${expected} api=${total}`;
    rows.push({ slug: e.slug, via: e.companyVia?.kind || 'tenant', expected, total, status });
  }
  const pad = (s, n) => String(s ?? '').padEnd(n);
  console.log(pad('ENTITY', 26) + pad('VIA', 10) + pad('DB', 8) + pad('API', 8) + 'STATUS');
  for (const r of rows) console.log(pad(r.slug, 26) + pad(r.via, 10) + pad(r.expected, 8) + pad(r.total, 8) + r.status);
  const bad = rows.filter((r) => r.status !== 'OK' && r.status !== '? no-census');
  console.log(`\n${rows.length} entities, ${bad.length} not-OK:`);
  for (const r of bad) console.log(`  - ${r.slug}: ${r.status}`);
};
run().catch((e) => { console.error(e); process.exit(1); });
