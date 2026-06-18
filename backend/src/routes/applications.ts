// Applications catalog — the systems where work is executed and memorialized
// (Bridge Input "Cap – Application Catalog" + pre-existing illustrative apps).
// Feeds the Applications tab; sidebar app items deep-link here.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { buildRoleResolver, resolveRoleCell } from '../lib/roleMatch.js';

const router = Router();
router.use(requireAuth);

// Curated everyday-user roles for apps that have no process-step usage (tools,
// platforms, data/infra) — the hands-on roles that actually live in the app,
// NOT the value stream's leadership. Takes precedence over the value-stream
// fallback. Names must match Role.name (unmatched names are dropped).
const EVERYDAY_USERS: Record<string, string[]> = {
  'Visual Studio Code': ['API Developer', 'Integration Developer', 'UI Developer', 'Mobile Developer', 'ETL Developer', 'Junior Developer', 'Senior Developer', 'Tech Lead', 'Database Administrator', 'DevOps / Platform Automation Engineer'],
  'IntelliJ IDEA': ['API Developer', 'Integration Developer', 'Senior Developer', 'Tech Lead', 'Database Administrator'],
  'Postman': ['API Developer', 'Integration Developer', 'Test Lead', 'QA Automation Engineer', 'Tech Lead'],
  'Docker': ['DevOps / Platform Automation Engineer', 'Cloud Engineer', 'Site Reliability Engineer', 'Platform Engineering Lead', 'Integration Developer'],
  'SonarQube': ['API Developer', 'Integration Developer', 'Tech Lead', 'Test Lead', 'QA Automation Engineer', 'DevOps / Platform Automation Engineer'],
  'CI/CD Pipeline': ['DevOps / Platform Automation Engineer', 'Site Reliability Engineer', 'Release Train Engineer', 'Integration Developer', 'Tech Lead'],
  'Collaboration / Chat': ['Business Analyst', 'Scrum Master', 'Product Owner', 'Tech Lead', 'Integration Developer'],
  'Azure Cloud Platform': ['Cloud Engineer', 'Cloud Architect', 'DevOps / Platform Automation Engineer', 'Site Reliability Engineer', 'Infrastructure / Network Engineer', 'Platform Engineering Lead'],
  'IAM Platform': ['IAM Engineer / PAM Engineer', 'IAM Analyst', 'Systems Administrator', 'IT Service Desk Analyst'],
  'SailPoint IGA': ['IAM Engineer / PAM Engineer', 'IAM Analyst', 'Security Analyst', 'ISO Architect'],
  'CrowdStrike Falcon': ['Security Analyst', 'SOC Lead', 'Vulnerability Management Lead / Security Engineering Lead', 'Cybersecurity Lead', 'Infrastructure / Network Engineer'],
  'Data Analytics Platform': ['Data Engineer', 'Data Scientist', 'Data Science Lead', 'ML Engineer', 'Data Analyst', 'ETL Developer'],
  'Databricks Lakehouse': ['Data Engineer', 'Data Scientist', 'ML Engineer', 'Data Science Lead', 'ETL Developer'],
  'SAS Actuarial Platform': ['Actuarial Analyst', 'Pricing Analyst', 'Reserving Actuary', 'Data Scientist', 'Actuarial Associate'],
  'BlackRock Aladdin': ['Portfolio Manager', 'Investment Analyst', 'Investment Operations Manager', 'Treasury Analyst'],
  'Bank & Treasury Network': ['Treasury Analyst', 'Treasury Manager', 'AR Reconciliation Analyst', 'Financial Analyst'],
  'Payment Gateway': ['Billing Analyst', 'Billing Coordinator', 'AR Reconciliation Analyst'],
  'Catastrophe Modeling': ['CAT Modeler', 'Capital Model Actuary', 'Reserving Actuary'],
  'Moody’s RMS (Cat Model)': ['CAT Modeler', 'Capital Model Actuary'],
  'Catastrophe Data Provider': ['CAT Modeler', 'Capital Model Actuary', 'Underwriting Analyst / Associate'],
  'Broker & Agent Portal': ['Sales / Distribution Analyst', 'Business Development Manager', 'Underwriting Assistant', 'Policy Administrator'],
  'Salesforce FSC': ['Sales / Distribution Analyst', 'Business Development Manager', 'Market Research Analyst'],
  'Customer Self-Service Portal': ['Policy Administrator', 'Claims Intake Rep', 'Billing Coordinator'],
  'Reinsurer Exchange': ['Ceded Reinsurance Analyst', 'Reinsurance Analyst', 'Facultative Reinsurance Specialist / Underwriter'],
  'Regulatory Filing Portal': ['Compliance Analyst', 'Statutory Reporting Analyst', 'Product / Filing Actuary'],
  'FRISS Fraud Detection': ['Claims Analyst', 'Claims Examiner', 'Claims Adjuster', 'Risk Analyst'],
  'Credit Bureau & Data Services': ['Underwriting Analyst / Associate', 'Underwriting Assistant', 'Claims Analyst'],
  'Viva Insights (Capacity Signals)': ['Workforce Analyst', 'People Analytics / HR Operations Manager', 'HR Business Partner'],
};

// C-suite / leadership titles are accountable owners, not everyday users — drop
// them from the role lists. (Line "officers" like Compliance/Privacy/DPO are
// kept: they are operational daily users of GRC/compliance apps.)
const isExec = (name: string) => /^(chief|head of|vp)\b/i.test(name);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const companyId = company.id;

    const [apps, usages, roles, roleVs] = await Promise.all([
      prisma.application.findMany({
        where: { companyId },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: {
          id: true, code: true, name: true, kind: true, category: true, vendor: true,
          criticality: true, description: true, systemOfRecord: true, illustrative: true,
          totalTco: true, primaryDivisionName: true,
          valueStreamLinks: { select: { valueStream: { select: { name: true } } } },
          _count: { select: { stepUsages: true, sorDeliverables: true } },
        },
      }),
      // every step an app is used on → that step's value stream + the role cells.
      prisma.stepAppUsage.findMany({
        where: { companyId, processStepId: { not: null } },
        select: { applicationId: true, processStep: { select: { leads: true, supporting: true, valueStream: { select: { name: true } } } } },
      }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } }),
      // roles that own/run each value stream — the fallback for apps with no step usage.
      prisma.roleValueStream.findMany({
        where: { role: { companyId } },
        select: { participationType: true, role: { select: { id: true, name: true } }, valueStream: { select: { name: true } } },
      }),
    ]);

    const resolve = buildRoleResolver(roles);
    // applicationId → { value-stream names, resolved roles }
    const enrich = new Map<string, { vs: Set<string>; roles: Map<string, string> }>();
    const bucket = (id: string) => {
      let b = enrich.get(id);
      if (!b) { b = { vs: new Set(), roles: new Map() }; enrich.set(id, b); }
      return b;
    };
    for (const u of usages) {
      if (!u.processStep) continue;
      const b = bucket(u.applicationId);
      if (u.processStep.valueStream?.name) b.vs.add(u.processStep.valueStream.name);
      for (const cell of [u.processStep.leads, u.processStep.supporting]) {
        for (const r of resolveRoleCell(cell, resolve).roles) if (!isExec(r.name)) b.roles.set(r.id, r.name);
      }
    }

    // value-stream name → its Core (hands-on, non-executive) roles — the fallback
    // for an app with no step usage and no curated user list.
    const vsRoles = new Map<string, { id: string; name: string }[]>();
    for (const rv of roleVs) {
      const n = rv.valueStream?.name;
      if (!n || rv.participationType !== 'Core' || isExec(rv.role.name)) continue;
      if (!vsRoles.has(n)) vsRoles.set(n, []);
      vsRoles.get(n)!.push({ id: rv.role.id, name: rv.role.name });
    }
    // role name (lower) → {id,name}, for resolving the curated user lists.
    const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), { id: r.id, name: r.name }]));

    res.json({
      applications: apps.map((a) => {
        const b = enrich.get(a.id);
        // value streams: explicit catalog links ∪ those derived from step usage.
        const vs = new Set<string>(a.valueStreamLinks.map((l) => l.valueStream.name));
        b?.vs.forEach((n) => vs.add(n));
        // roles, in priority order: a curated everyday-user list (tools/infra) →
        // precise step-derived roles → the value streams' Core hands-on roles.
        let roleList: { id: string; name: string }[];
        const curated = EVERYDAY_USERS[a.name];
        if (curated) {
          roleList = curated.map((n) => roleByName.get(n.toLowerCase())).filter((r): r is { id: string; name: string } => !!r);
        } else if (b && b.roles.size) {
          roleList = [...b.roles.entries()].map(([id, name]) => ({ id, name }));
        } else {
          const fallback = new Map<string, string>();
          for (const n of vs) for (const r of vsRoles.get(n) ?? []) fallback.set(r.id, r.name);
          roleList = [...fallback.entries()].map(([id, name]) => ({ id, name }));
        }
        roleList.sort((x, y) => x.name.localeCompare(y.name));
        return {
          id: a.id, code: a.code, name: a.name, kind: a.kind, category: a.category, vendor: a.vendor,
          criticality: a.criticality, description: a.description, systemOfRecord: a.systemOfRecord, illustrative: a.illustrative,
          totalTco: a.totalTco, primaryDivisionName: a.primaryDivisionName,
          stepUsages: a._count.stepUsages, sorDeliverables: a._count.sorDeliverables,
          valueStreams: [...vs].sort((x, y) => x.localeCompare(y)),
          roles: roleList,
        };
      }),
    });
  } catch (e) { next(e); }
});

export default router;
