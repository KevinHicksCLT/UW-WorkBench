// One-off repair for the 2026-06-11 top-to-checklist audit findings:
// 1. RC-19-03 / CI-26-03 steps had no supporting role.
// 2. Rename collisions: updateMany-by-name stole SVS5 mirrors / a work task
//    from same-named steps in sibling L4s.
// 3. Three round-1 L4s were created before their L3 rows existed.
// 4. The 15 role-catalog roles had no RoleValueStream outputs (role-page deliverables).
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const company = await p.company.findFirst({ select: { id: true, tenantId: true } });
const tenantId = company.tenantId;
const fixed = { supporting: 0, svs5: 0, dedup: 0, l3: 0, task: 0, rvs: 0 };

// 1. Fill missing supporting
for (const [prefix, sup] of [['RC-19-03', 'Audit Associate'], ['CI-26-03', 'Collections Recovery Specialist']]) {
  const r = await p.processStep.updateMany({ where: { code: { startsWith: prefix }, supporting: null }, data: { supporting: sup } });
  const ss = await p.processStep.findMany({ where: { code: { startsWith: prefix } }, select: { id: true, supporting: true } });
  for (const s of ss) {
    const n = await p.node.findFirst({ where: { typeKey: 'step', code: s.id }, select: { id: true, attributes: true } });
    if (n) await p.node.update({ where: { id: n.id }, data: { attributes: { ...(n.attributes ?? {}), supporting: s.supporting } } });
  }
  fixed.supporting += r.count;
}

// 2. SVS5 mirror repair: dedupe stolen rows, then create missing mirrors
const steps = await p.processStep.findMany({ select: { id: true, name: true, valueStreamId: true, l4: true, inputs: true, outputs: true } });
const svs4 = await p.subValueStream.findMany({ where: { level: 4 }, select: { id: true, name: true, valueStreamId: true } });
const svs4Key = new Map(svs4.map((x) => [x.valueStreamId + '|' + x.name, x.id]));
const svs5 = await p.subValueStream.findMany({ where: { level: 5 }, select: { id: true, name: true, valueStreamId: true, parentId: true } });
const svs5Count = new Map();
for (const x of svs5) { const k = x.valueStreamId + '|' + x.name; svs5Count.set(k, (svs5Count.get(k) ?? 0) + 1); }
const stepCount = new Map();
for (const s of steps) { const k = s.valueStreamId + '|' + s.name; stepCount.set(k, (stepCount.get(k) ?? 0) + 1); }
for (const [k, c] of svs5Count) {
  const want = stepCount.get(k) ?? 0;
  if (c <= want) continue;
  const rows = svs5.filter((x) => x.valueStreamId + '|' + x.name === k);
  const stepL4s = new Set(steps.filter((s) => s.valueStreamId + '|' + s.name === k).map((s) => svs4Key.get(s.valueStreamId + '|' + s.l4)));
  const keep = rows.filter((x) => stepL4s.has(x.parentId)).slice(0, Math.max(want, 1));
  const drop = rows.filter((x) => !keep.includes(x)).slice(0, c - want);
  for (const x of drop) { await p.subValueStream.delete({ where: { id: x.id } }); fixed.dedup++; }
}
const have = new Set((await p.subValueStream.findMany({ where: { level: 5 }, select: { name: true, valueStreamId: true } })).map((x) => x.valueStreamId + '|' + x.name));
for (const s of steps) {
  const k = s.valueStreamId + '|' + s.name;
  if (have.has(k)) continue;
  await p.subValueStream.create({ data: { tenantId, valueStreamId: s.valueStreamId, parentId: svs4Key.get(s.valueStreamId + '|' + s.l4) ?? null, name: s.name, level: 5, inputs: s.inputs, outputs: s.outputs, sourceSheet: 'research', notes: 'Mirror repaired after rename collision (2026-06-11)' } });
  have.add(k);
  fixed.svs5++;
}

// 3. Missing L3 rows + re-parent their L4s
for (const [vsId, l3name] of [
  ['cmpzuwwbm00bx5mhs0xd3qked', 'Audit Quality & Methodology'],
  ['cmpzuwwbm00c35mhs9ko7j2kc', 'Threat & Vulnerability Management'],
  ['cmpzuwwbm00bt5mhsx4skm02r', 'Request Fulfillment'],
]) {
  const row = await p.subValueStream.create({ data: { tenantId, valueStreamId: vsId, level: 3, name: l3name, sourceSheet: 'research' }, select: { id: true } });
  const l4names = [...new Set((await p.processStep.findMany({ where: { valueStreamId: vsId, l3: l3name }, select: { l4: true } })).map((x) => x.l4))];
  await p.subValueStream.updateMany({ where: { valueStreamId: vsId, level: 4, name: { in: l4names }, parentId: null }, data: { parentId: row.id } });
  fixed.l3++;
}

// 4. Un-steal the work task (CI-02-04-S02 "Negotiate Settlement")
const dups = await p.task.findMany({ where: { source: 'process', title: 'Negotiate Pre-Trial Resolution' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
if (dups.length > 1) { await p.task.update({ where: { id: dups[0].id }, data: { title: 'Negotiate Settlement' } }); fixed.task++; }

// 5. Role-page deliverable outputs for the 15 role-catalog roles
const IO = {
  'Chief Executive Officer': ['Enterprise Strategy & Portfolio Management', 'Board materials, market and performance insight, strategic options, risk appetite', 'Strategic direction, approved plans and budgets, executive decisions, performance reviews'],
  'Chief Audit Executive': ['Audit & Assurance', 'Audit universe, risk assessments, audit committee priorities, regulatory expectations', 'Approved audit plan, audit opinions, audit committee reporting, QAIP results'],
  'Field Claims Adjuster': ['Claims Intake-to-Settlement', 'Assigned claims, site access, policy and coverage data, repair estimates', 'Field inspection reports, damage assessments, scope-of-loss estimates, settlement recommendations'],
  'Claims Examiner': ['Claims Intake-to-Settlement', 'Claim files, coverage documents, medical and repair evidence, authority limits', 'Coverage determinations, reserve recommendations, approved payments, referral notes'],
  'SIU Manager': ['Claims Intake-to-Settlement', 'Fraud referrals, investigation results, regulatory reporting obligations, analytics alerts', 'SIU case dispositions, fraud referrals to regulators, investigation standards, savings reporting'],
  'SIU Field Investigator': ['Claims Intake-to-Settlement', 'Assigned SIU cases, surveillance plans, public records, interview leads', 'Investigation reports, evidence packages, recorded statements, case recommendations'],
  'Data Analyst': ['Data, Analytics & AI Management', 'Business questions, source data extracts, reporting requirements, data quality rules', 'Analyses and insights, dashboards and reports, validated datasets, metric definitions'],
  'Legal Counsel': ['Legal, Governance & Privacy Management', 'Legal requests, contracts and disputes, regulatory developments, policy wording questions', 'Legal advice and opinions, reviewed contracts, dispute resolutions, filings'],
  'Procurement Manager': ['Third-Party & Vendor Management', 'Purchase requests, vendor proposals, contract terms, spend data', 'Sourcing decisions, negotiated agreements, purchase orders, vendor savings reporting'],
  'Territory Manager': ['Distribution & Channel Management', 'Territory production data, agency pipeline, market intelligence, growth targets', 'Territory plans, agency development actions, production results, market feedback'],
  'Contact Center Supervisor': ['Customer Service, Complaints & Experience', 'Queue and service-level data, quality scores, staffing schedules, escalations', 'Shift schedules, coaching plans, resolved escalations, service-level reporting'],
  'Marketing Manager': ['Marketing, Growth & Customer Insights', 'Campaign briefs, market research, brand guidelines, budget allocations', 'Campaign plans and results, marketing content, lead pipelines, performance reporting'],
  'Trader': ['Investment & Asset Management', 'Approved trade orders, market data, investment guidelines, liquidity needs', 'Executed trades, trade confirmations, execution quality reporting, market color'],
  'Accounts Payable Specialist': ['Finance, Treasury & Capital Management', 'Vendor invoices, payment approvals, purchase orders, payment terms', 'Processed payments, reconciled payables, vendor statements, aging reports'],
  'Distribution Specialist': ['Distribution & Channel Management', 'Producer onboarding requests, channel performance data, appointment records, commission queries', 'Onboarded producers, channel support resolutions, appointment filings, commission corrections'],
};
const rank = (n) => /chief|ceo|president/i.test(n) ? 'Oversight' : /head|officer|director|manager|supervisor|executive/i.test(n) ? 'Lead' : 'Core';
for (const [name, [vsName, inputs, outputs]] of Object.entries(IO)) {
  const role = await p.role.findFirst({ where: { name }, select: { id: true, valueStreamLinks: { select: { id: true, outputs: true } } } });
  if (!role || role.valueStreamLinks.some((l) => l.outputs)) continue;
  const vs = await p.valueStream.findFirst({ where: { name: vsName }, select: { id: true } });
  if (!vs) { console.warn('no stream', vsName); continue; }
  if (role.valueStreamLinks[0]) await p.roleValueStream.update({ where: { id: role.valueStreamLinks[0].id }, data: { inputs, outputs } });
  else await p.roleValueStream.create({ data: { tenantId, roleId: role.id, valueStreamId: vs.id, participationType: rank(name), inputs, outputs, sourceSheet: 'backfill' } });
  fixed.rvs++;
}

console.log('fixed:', JSON.stringify(fixed));
await p.$disconnect();
