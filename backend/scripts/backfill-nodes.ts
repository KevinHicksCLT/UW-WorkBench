// P3 — backfill the unified Node tree from legacy tables (operating-model rework).
// DATA-TRUE: 1:1, original legacy id kept as Node.code, names verbatim, provenance
// carried. Idempotent: wipes+rebuilds the company's Nodes (Node is a derived table).
// This pass does the ORG branch: Enterprise → Segment → Division → Department → Role.
// The WORK branch (value_stream → sub_process → step → io_item) is added next.
// See docs/operating-model-architecture.md.
import { prisma } from '../src/db/prisma.js';

const prov = (illustrative: boolean | null | undefined) => (illustrative === false ? 'real' : 'illustrative');

// Display order lives in the DATA (Node.sortOrder), not in route constants:
// segments in the canonical order, divisions by their place in the value chain.
const SEG_ORDER = ['Core Business', 'IT', 'Corporate Function'];
const DIV_ORDER = [
  'Sales, Distribution & Marketing', 'Underwriting', 'Actuarial', 'Claims', 'Reinsurance', 'Operations & Customer Service',
  'Product, Delivery & PMO', 'Technology & Engineering', 'Data & AI', 'Cybersecurity & IAM',
  'Human Resources & Talent', 'Finance & Investments', 'Legal & Corporate Governance', 'Risk, Compliance & Audit',
];
const rank = (list: string[], name: string, fallback: number) => { const i = list.indexOf(name); return i === -1 ? fallback : i; };

// Canonical 29 workbook streams → org division that hosts them (the stream's
// "domain" column is the workbook taxonomy; the division is the org home used
// for the map/list grouping). Every ValueStream row must appear here.
const VS_DIVISION: Record<string, string> = {
  // Core Insurance
  'Billing, Collections & Receivables': 'Finance & Investments',
  'Claims Intake-to-Settlement': 'Claims',
  'Claims Recoveries & Subrogation': 'Claims',
  'Delegated Authority Management': 'Underwriting',
  'Policy Administration & Servicing': 'Operations & Customer Service',
  'Reinsurance & Retrocession Management': 'Reinsurance',
  'Submission-to-Bind / Underwriting': 'Underwriting',
  // Distribution & Customer
  'Customer Service, Complaints & Experience': 'Operations & Customer Service',
  'Distribution & Channel Management': 'Sales, Distribution & Marketing',
  'Marketing, Growth & Customer Insights': 'Sales, Distribution & Marketing',
  'Product & Proposition Management': 'Product, Delivery & PMO',
  // Finance & Actuarial
  'Actuarial Pricing, Reserving & Capital Modeling': 'Actuarial',
  'Finance, Treasury & Capital Management': 'Finance & Investments',
  'Investment & Asset Management': 'Finance & Investments',
  // Technology & Data
  'AIOps & Intelligent Operations': 'Technology & Engineering',
  'Cybersecurity, Identity & Resilience': 'Cybersecurity & IAM',
  'Data, Analytics & AI Management': 'Data & AI',
  'FinOps / Cloud Financial Management': 'Technology & Engineering',
  'MLOps / ML Lifecycle Management': 'Data & AI',
  'Service Operations, Incident & Production Support': 'Technology & Engineering',
  'Technology Delivery & Change': 'Technology & Engineering',
  'Technology Strategy, Architecture & Delivery': 'Technology & Engineering',
  // Risk, Compliance & Audit
  'Audit & Assurance': 'Risk, Compliance & Audit',
  'Risk, Compliance & Regulatory Management': 'Risk, Compliance & Audit',
  'Third-Party & Vendor Management': 'Risk, Compliance & Audit',
  // Corporate & Enterprise
  'Change Management & Adoption': 'Human Resources & Talent',
  'Enterprise Strategy & Portfolio Management': 'Product, Delivery & PMO',
  'Legal, Governance & Privacy Management': 'Legal & Corporate Governance',
  'Talent & Workforce Management': 'Human Resources & Talent',
};
const DOMAIN_ORDER = ['Core Insurance', 'Distribution & Customer', 'Finance & Actuarial', 'Technology & Data', 'Risk, Compliance & Audit', 'Corporate & Enterprise'];

// Pre-canonicalization node names → canonical workbook names, used ONLY to carry
// hand-edited NodeAiAdoption rows across the rebuild.
const OLD_VS_NAME: Record<string, string> = {
  'Actuarial & Reserving': 'Actuarial Pricing, Reserving & Capital Modeling',
  'Submission-to-Bind': 'Submission-to-Bind / Underwriting',
  'Distribution Management': 'Distribution & Channel Management',
  'Data & Analytics': 'Data, Analytics & AI Management',
  'Investment Management': 'Investment & Asset Management',
  'Legal & Compliance': 'Legal, Governance & Privacy Management',
  'Product Design & Management': 'Product & Proposition Management',
  'Reinsurance Management': 'Reinsurance & Retrocession Management',
  'Human Capital Management': 'Talent & Workforce Management',
  'Vendor & Third-Party Management': 'Third-Party & Vendor Management',
  'Customer Service & Experience': 'Customer Service, Complaints & Experience',
  'Capital & Treasury Management': 'Finance, Treasury & Capital Management',
  'Risk & Compliance Management': 'Risk, Compliance & Regulatory Management',
};

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const company of companies) {
    const companyId = company.id;

    // ── baseline (pre-backfill legacy counts) ──
    const [divisions, departments, roles] = await Promise.all([
      prisma.division.findMany({ where: { companyId }, select: { id: true, name: true, higherCategory: true } }),
      prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true, departmentId: true, roleLevel: true, roleFamily: true, status: true } }),
    ]);
    const segments = [...new Set(divisions.map((d) => d.higherCategory).filter((s): s is string => !!s))];

    // Carry AI-adoption edits across the rebuild (NodeAiAdoption cascades away
    // with its node): snapshot by stream NAME, restore onto the canonical names.
    const adoptionSnap = await prisma.nodeAiAdoption.findMany({
      where: { node: { companyId, typeKey: 'value_stream' } },
      include: { node: { select: { name: true } } },
    });

    // Rebuild this company's nodes from scratch (derived table).
    await prisma.node.deleteMany({ where: { companyId } });

    // L0 Enterprise root
    const enterprise = await prisma.node.create({ data: { companyId, typeKey: 'enterprise', name: company.name, provenance: 'real', sortOrder: 0 } });

    // L1 Segments (the ONE shared grouping) from distinct Division.higherCategory
    const segByName = new Map<string, string>();
    for (const [i, name] of segments.entries()) {
      const n = await prisma.node.create({ data: { companyId, typeKey: 'segment', name, parentId: enterprise.id, provenance: 'real', sortOrder: rank(SEG_ORDER, name, 90 + i) } });
      segByName.set(name, n.id);
    }

    // L2 Divisions → parent = its segment node (by higherCategory)
    const divByLegacyId = new Map<string, string>();
    const divByName = new Map<string, string>();
    for (const [i, d] of divisions.entries()) {
      const parentId = d.higherCategory ? segByName.get(d.higherCategory) ?? enterprise.id : enterprise.id;
      const n = await prisma.node.create({ data: { companyId, typeKey: 'division', name: d.name, code: d.id, parentId, provenance: 'real', sortOrder: rank(DIV_ORDER, d.name, 900 + i) } });
      divByLegacyId.set(d.id, n.id);
      divByName.set(d.name, n.id);
    }

    // L3 Departments → parent = its division node (Department.divisionId)
    const deptByLegacyId = new Map<string, string>();
    for (const [i, d] of departments.entries()) {
      const parentId = divByLegacyId.get(d.divisionId);
      const n = await prisma.node.create({ data: { companyId, typeKey: 'department', name: d.name, code: d.id, parentId: parentId ?? null, provenance: 'real', sortOrder: i } });
      deptByLegacyId.set(d.id, n.id);
    }

    // L4 Roles → parent = department node, else division node, else logged orphan
    const orphanRoles: string[] = [];
    for (const [i, r] of roles.entries()) {
      let parentId: string | null = null;
      if (r.departmentId) parentId = deptByLegacyId.get(r.departmentId) ?? null;
      if (!parentId && r.divisionId) parentId = divByLegacyId.get(r.divisionId) ?? null;
      if (!parentId) orphanRoles.push(r.name);
      await prisma.node.create({
        data: { companyId, typeKey: 'role', name: r.name, code: r.id, parentId, provenance: prov(undefined), sortOrder: i,
          attributes: { roleLevel: r.roleLevel ?? null, roleFamily: r.roleFamily ?? null, status: r.status ?? null } },
      });
    }

    // ── WORK branch (29-stream canonicalization, gap backlog X3/S1/S2/S3):
    // value_stream ← ValueStream (29, names verbatim), sub_process ← SubValueStream
    // level=4 (131), step ← ProcessStep (711), io_item ← IoItem (835, keyed to its
    // L4 sub-process). The curated Level tree is no longer the source. ──
    const vsRows = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true, domain: true } });
    vsRows.sort((a, b) => rank(DOMAIN_ORDER, a.domain ?? '', 99) - rank(DOMAIN_ORDER, b.domain ?? '', 99) || a.name.localeCompare(b.name));
    const vsNodeByName = new Map<string, string>();
    const vsNodeByLegacyId = new Map<string, string>();
    const unmatchedVs: string[] = [];
    for (const [i, vs] of vsRows.entries()) {
      const divName = VS_DIVISION[vs.name];
      const parentId = divName ? divByName.get(divName) ?? null : null;
      if (!parentId) unmatchedVs.push(vs.name);
      const n = await prisma.node.create({
        data: { companyId, typeKey: 'value_stream', name: vs.name, code: vs.id, parentId, provenance: 'real', sortOrder: i,
          attributes: { domain: vs.domain ?? null } },
      });
      vsNodeByName.set(vs.name, n.id);
      vsNodeByLegacyId.set(vs.id, n.id);
    }

    // sub_process ← SubValueStream level=4 (parent = its stream node; the L3
    // process area is carried as an attribute, not a tree level)
    const svsAll = await prisma.subValueStream.findMany({
      where: { valueStream: { companyId } },
      orderBy: { sourceRow: 'asc' },
      select: { id: true, name: true, level: true, parentId: true, valueStreamId: true, inputs: true, outputs: true, upstream: true, downstream: true, notes: true },
    });
    const l3NameById = new Map(svsAll.filter((s) => s.level === 3).map((s) => [s.id, s.name]));
    const l4Rows = svsAll.filter((s) => s.level === 4);
    const spByVsAndName = new Map<string, string>(); // `${valueStreamId}|${l4 name}` → node id
    for (const [i, s] of l4Rows.entries()) {
      const processArea = s.parentId ? l3NameById.get(s.parentId) ?? null : null;
      const n = await prisma.node.create({
        data: { companyId, typeKey: 'sub_process', name: s.name, code: s.id, parentId: vsNodeByLegacyId.get(s.valueStreamId) ?? null, provenance: 'real', sortOrder: i,
          attributes: { processArea, inputs: s.inputs, outputs: s.outputs, upstream: s.upstream, downstream: s.downstream, notes: s.notes } },
      });
      spByVsAndName.set(`${s.valueStreamId}|${s.name}`, n.id);
    }

    // step ← ProcessStep (parent = its L4 sub-process node; falls back to the
    // stream node when the l4 label doesn't match a SubValueStream row — logged)
    const stepRows = await prisma.processStep.findMany({
      where: { valueStream: { companyId } },
      orderBy: [{ l4: 'asc' }, { stepNumber: 'asc' }],
      select: { id: true, name: true, valueStreamId: true, l3: true, l4: true, stepNumber: true, description: true, leads: true, supporting: true, inputs: true, outputs: true, notes: true, externalParticipants: true, illustrative: true },
    });
    let stepFallback = 0;
    for (const [i, ps] of stepRows.entries()) {
      let parentId = ps.l4 ? spByVsAndName.get(`${ps.valueStreamId}|${ps.l4}`) ?? null : null;
      if (!parentId) { parentId = vsNodeByLegacyId.get(ps.valueStreamId) ?? null; stepFallback++; }
      await prisma.node.create({
        data: { companyId, typeKey: 'step', name: ps.name, code: ps.id, parentId, description: ps.description, provenance: prov(ps.illustrative), sortOrder: ps.stepNumber ?? i,
          attributes: { stepNumber: ps.stepNumber, l3: ps.l3, l4: ps.l4, leads: ps.leads, supporting: ps.supporting, inputs: ps.inputs, outputs: ps.outputs, notes: ps.notes, externalParticipants: ps.externalParticipants } },
      });
    }

    // io_item ← IoItem (parent = its L4 sub-process node, else its stream node)
    const ioItems = await prisma.ioItem.findMany({ where: { valueStream: { companyId } }, select: { id: true, name: true, type: true, valueStreamId: true, keyRoles: true, dataElements: true, l3: true, l4: true, illustrative: true } });
    let ioToSubProcess = 0;
    const unmatchedIo: string[] = [];
    for (const io of ioItems) {
      let parentId = io.l4 ? spByVsAndName.get(`${io.valueStreamId}|${io.l4}`) ?? null : null;
      if (parentId) ioToSubProcess++;
      else parentId = vsNodeByLegacyId.get(io.valueStreamId) ?? null;
      if (!parentId) unmatchedIo.push(io.name);
      await prisma.node.create({
        data: { companyId, typeKey: 'io_item', name: io.name, code: io.id, parentId, provenance: prov(io.illustrative),
          attributes: { type: io.type, keyRoles: io.keyRoles, dataElements: io.dataElements, l3: io.l3, l4: io.l4 } },
      });
    }

    // Restore AI-adoption edits onto the canonical stream names.
    let adoptionRestored = 0;
    for (const snap of adoptionSnap) {
      const target = vsNodeByName.get(snap.node.name) ?? vsNodeByName.get(OLD_VS_NAME[snap.node.name] ?? '');
      if (!target) continue;
      await prisma.nodeAiAdoption.upsert({
        where: { nodeId: target },
        create: { nodeId: target, aiAssist: snap.aiAssist, aiAugment: snap.aiAugment, aiWorkflow: snap.aiWorkflow, aiAutonomous: snap.aiAutonomous, useCases: snap.useCases ?? undefined },
        update: { aiAssist: snap.aiAssist, aiAugment: snap.aiAugment, aiWorkflow: snap.aiWorkflow, aiAutonomous: snap.aiAutonomous, useCases: snap.useCases ?? undefined },
      });
      adoptionRestored++;
    }

    // ── reconcile ──
    const counts = await prisma.node.groupBy({ by: ['typeKey'], where: { companyId }, _count: { _all: true } });
    const got = Object.fromEntries(counts.map((c) => [c.typeKey, c._count._all]));
    const expect = {
      enterprise: 1, segment: segments.length, division: divisions.length, department: departments.length, role: roles.length,
      value_stream: vsRows.length, sub_process: l4Rows.length, step: stepRows.length, io_item: ioItems.length,
    };
    console.log(`\n=== ${company.name} (${companyId}) ===`);
    for (const [k, v] of Object.entries(expect)) {
      const g = got[k] ?? 0;
      console.log(`  ${k.padEnd(11)} expect ${String(v).padStart(4)}  got ${String(g).padStart(4)}  ${g === v ? 'OK' : 'MISMATCH'}`);
    }
    if (orphanRoles.length) console.log(`  ⚠ ${orphanRoles.length} roles with no department/division parent (logged): ${orphanRoles.slice(0, 8).join(', ')}${orphanRoles.length > 8 ? '…' : ''}`);
    if (unmatchedVs.length) console.log(`  ⚠ ${unmatchedVs.length} value streams with no division parent (logged): ${unmatchedVs.join(', ')}`);
    console.log(`  steps: ${stepRows.length - stepFallback}/${stepRows.length} under their L4 sub-process (${stepFallback} fell back to the stream node)`);
    console.log(`  io_item: ${ioToSubProcess}/${ioItems.length} under their L4 sub-process; ${unmatchedIo.length} unattached`);
    console.log(`  ai-adoption: ${adoptionRestored}/${adoptionSnap.length} stream profiles carried across the rebuild`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
