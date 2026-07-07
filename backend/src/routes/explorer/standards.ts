/**
 * The Organization table + the department-standards endpoints (area→group→leaf).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { vsForStandards, type VsRef } from '../../lib/govRollup.js';
import { skillName } from '../../lib/skillPacks.js';
import { structureCounts, streamAncestry } from '../../lib/resolvers/index.js';
import { activeCompany } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerOrgStandardsRoutes(router: Router): void {
  router.get('/org-table', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const c = company.id;

      const [orgTypes, units, roles, counts, allNodeRoles, valueStreams] = await Promise.all([
        prisma.orgLevelType.findMany({
          where: { companyId: c },
          select: { id: true, levelNumber: true },
        }),
        prisma.orgUnit.findMany({
          where: { companyId: c },
          orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
          select: { id: true, displayValue: true, parentId: true, orgLevelTypeId: true },
        }),
        prisma.role.findMany({
          where: { companyId: c },
          orderBy: { displayValue: 'asc' },
          select: { id: true, displayValue: true, orgUnitId: true },
        }),
        structureCounts(c),
        prisma.nodeRole.findMany({
          where: { companyId: c },
          select: { roleId: true, role_: true, processNodeId: true },
        }),
        (async () => {
          const types = await prisma.processLevelType.findMany({
            where: { companyId: c },
            select: { id: true, levelNumber: true },
          });
          const l2 = types.find((t) => t.levelNumber === 2)?.id;
          return l2
            ? prisma.processNode.findMany({
                where: { companyId: c, processLevelTypeId: l2 },
                orderBy: { displayValue: 'asc' },
                select: {
                  id: true,
                  displayValue: true,
                  parent: { select: { displayValue: true } },
                },
              })
            : [];
        })(),
      ]);
      const levelOf = new Map(orgTypes.map((t) => [t.id, t.levelNumber]));
      const segNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 1);
      const divNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 2);
      const deptNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 3); // Department tier (L3)
      const byId = new Map(units.map((u) => [u.id, u]));
      // departments grouped under their division (parentId = the L2 division).
      const deptsByDivision = new Map<string, typeof deptNodes>();
      for (const dp of deptNodes) {
        if (!dp.parentId) continue;
        if (!deptsByDivision.has(dp.parentId)) deptsByDivision.set(dp.parentId, []);
        deptsByDivision.get(dp.parentId)!.push(dp);
      }

      // roles' value-stream participation, resolved via NodeRole + closure. The org
      // table only needs each node's value stream + domain, so use the lean ancestry
      // resolver (skips l3/l4 + the org-derived division/department join).
      const partNodeIds = [...new Set(allNodeRoles.map((n) => n.processNodeId))];
      const loc = await streamAncestry(partNodeIds);
      const partByRole = new Map<
        string,
        Map<
          string,
          {
            valueStreamId: string;
            valueStreamName: string;
            domain: string | null;
            participationType: string;
          }
        >
      >();
      for (const nr of allNodeRoles) {
        const a = loc.get(nr.processNodeId);
        if (!a?.valueStreamId) continue;
        let m = partByRole.get(nr.roleId);
        if (!m) {
          m = new Map();
          partByRole.set(nr.roleId, m);
        }
        const part = nr.role_ === 'Owner' ? 'Lead' : 'Support';
        const cur = m.get(a.valueStreamId);
        if (!cur || (part === 'Lead' && cur.participationType !== 'Lead')) {
          m.set(a.valueStreamId, {
            valueStreamId: a.valueStreamId,
            valueStreamName: a.valueStreamName ?? '—',
            domain: a.domain,
            participationType: part,
          });
        }
      }

      // roles homed under each division org unit.
      type RoleEntry = {
        id: string;
        name: string;
        roleLevel: null;
        roleFamily: null;
        valueStreamCount: number;
        participations: {
          valueStreamId: string;
          valueStreamName: string;
          domain: string | null;
          participationType: string;
        }[];
      };
      const rolesByUnit = new Map<string, RoleEntry[]>();
      const unassigned: RoleEntry[] = [];
      for (const r of roles) {
        const part = [...(partByRole.get(r.id)?.values() ?? [])];
        const entry = {
          id: r.id,
          name: r.displayValue,
          roleLevel: null,
          roleFamily: null,
          valueStreamCount: part.length,
          participations: part,
        };
        if (!r.orgUnitId) {
          unassigned.push(entry);
          continue;
        }
        if (!rolesByUnit.has(r.orgUnitId)) rolesByUnit.set(r.orgUnitId, []);
        rolesByUnit.get(r.orgUnitId)!.push(entry);
      }

      const divisionRows = divNodes.map((dv) => {
        // roles homed directly to the L2 division → looseRoles ("Direct to division").
        const looseRoles = rolesByUnit.get(dv.id) ?? [];
        // roles homed to an L3 department under this division → that department.
        const departments = (deptsByDivision.get(dv.id) ?? [])
          .map((dp) => {
            const roles = rolesByUnit.get(dp.id) ?? [];
            return { id: dp.id, name: dp.displayValue, roles, roleCount: roles.length };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        const deptRoleCount = departments.reduce((a, d) => a + d.roleCount, 0);
        const segment = dv.parentId
          ? (byId.get(dv.parentId)?.displayValue ?? 'Core Business')
          : 'Core Business';
        return {
          id: dv.id,
          name: dv.displayValue,
          segment,
          departments,
          looseRoles,
          roleCount: looseRoles.length + deptRoleCount,
          _segId: dv.parentId,
        };
      });

      type DivisionRow = {
        id: string;
        name: string;
        segment: string;
        roleCount: number;
        departments: { id: string; name: string; roles: RoleEntry[]; roleCount: number }[];
        looseRoles: RoleEntry[];
      };
      type SegmentRow = {
        id: string | null;
        name: string;
        divisions: DivisionRow[];
        divisionCount: number;
        roleCount: number;
      };
      const segments: SegmentRow[] = segNodes
        .map((s) => {
          const divs = divisionRows.filter((d) => d._segId === s.id).map(({ _segId, ...d }) => d);
          // `id` is the segment's OrgUnit L1 id — lets the map edit/move/rename it.
          return {
            id: s.id,
            name: s.displayValue,
            divisions: divs,
            divisionCount: divs.length,
            roleCount: divs.reduce((a, x) => a + x.roleCount, 0),
          };
        })
        .filter((s) => s.divisions.length > 0);
      if (unassigned.length) {
        segments.push({
          id: null,
          name: 'Unassigned',
          divisions: [
            {
              id: '__unassigned',
              name: 'Unassigned roles',
              segment: 'Unassigned',
              departments: [],
              looseRoles: unassigned,
              roleCount: unassigned.length,
            },
          ],
          divisionCount: 0,
          roleCount: unassigned.length,
        });
      }

      res.json({
        company,
        totals: {
          segments: counts.segments,
          divisions: counts.divisions,
          departments: counts.departments,
          roles: counts.roles,
          valueStreams: counts.valueStreams,
        },
        valueStreams: valueStreams.map((v) => ({
          id: v.id,
          name: v.displayValue,
          domain: v.parent?.displayValue ?? null,
        })),
        segments,
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Standards (department standards: area → group → leaf, on the Standard tree) ─
  // areas = isArea Standards; groups = their direct children; leaves = the groups'
  // children. The owner role (ownerRoleId) and the value streams (via NodeStandard)
  // resolve to real ids for the front-end's role/VS links.

  // Shared shaping of a leaf/group Standard row into the front-end Item contract.
  type StdRow = {
    id: string;
    category: string | null;
    name: string;
    description: string | null;
    buildRun: string | null;
    ownerLabel: string | null;
    relatedRole: string | null;
    relatedCategory: string | null;
    link: string | null;
    agentSkill: string | null;
    sdlcGates: string | null;
    regCitation: string | null;
    testProcedure: string | null;
    evidence: string | null;
    ownerRole: { id: string; displayValue: string } | null;
    roleStandards: { role: { id: string; displayValue: string } | null }[];
  };
  // Standards attach to TASK nodes only; the "applies to value streams" chips are
  // a rollup of the linked tasks' L2 ancestors (vsForStandards / govRollup.ts).
  function shapeItem(r: StdRow, vsMap: Map<string, VsRef[]>) {
    const valueStreams = vsMap.get(r.id) ?? [];
    // Appliers = the roles that EXECUTE the control day-to-day (RoleStandard),
    // distinct from the accountable OWNER (ownerRole). De-duped by role id.
    const seen = new Set<string>();
    const appliers = r.roleStandards
      .map((rs) => rs.role)
      .filter(
        (role): role is NonNullable<typeof role> =>
          !!role && !seen.has(role.id) && (seen.add(role.id), true),
      )
      .map((role) => ({ roleId: role.id, roleName: role.displayValue }));
    return {
      id: r.id,
      category: r.category ?? '—',
      name: r.name,
      description: r.description ?? '',
      buildRun: r.buildRun,
      ownerRole: r.ownerLabel,
      relatedRole: r.relatedRole,
      relatedCategory: r.relatedCategory,
      itemsLink: r.link,
      agentSkill: r.agentSkill, // per-standard tailored skill (Standard.agentSkill)
      categorySkill: r.category ? skillName(r.category) : null, // the category rollup skill
      sdlcGates: r.sdlcGates,
      regCitation: r.regCitation,
      testProcedure: r.testProcedure,
      evidence: r.evidence,
      responsible: r.ownerRole
        ? {
            roleId: r.ownerRole.id,
            roleName: r.ownerRole.displayValue,
            roleLevel: null as string | null,
          }
        : null,
      appliers,
      valueStreams,
    };
  }

  const STD_ITEM_SELECT = {
    id: true,
    category: true,
    name: true,
    description: true,
    buildRun: true,
    ownerLabel: true,
    relatedRole: true,
    relatedCategory: true,
    link: true,
    agentSkill: true,
    sdlcGates: true,
    regCitation: true,
    testProcedure: true,
    evidence: true,
    ownerRole: { select: { id: true, displayValue: true } },
    roleStandards: { select: { role: { select: { id: true, displayValue: true } } } },
  } as const;

  router.get('/standards', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const areas = await prisma.standard.findMany({
        where: { companyId: company.id, isArea: true },
        orderBy: { department: 'asc' },
        select: {
          id: true,
          department: true,
          name: true,
          charterIncluded: true,
          ownerLabel: true,
          link: true,
          _count: { select: { children: true } },
        },
      });
      // Leaf count per area = all non-area descendants (groups + their leaves). The
      // displayed "standards" count is the number of individual (leaf-or-childless)
      // standards; cheaper to count all descendants via a single groupBy on parent
      // chain is overkill — count descendants by walking parentId twice (2 levels).
      const groupCounts = await prisma.standard.groupBy({
        by: ['parentId'],
        where: { companyId: company.id, isArea: false },
        _count: { _all: true },
      });
      const childCount = new Map<string, number>();
      for (const g of groupCounts) if (g.parentId) childCount.set(g.parentId, g._count._all);
      // group ids per area (to roll their children into the area total).
      const groups = await prisma.standard.findMany({
        where: { companyId: company.id, isArea: false, parent: { isArea: true } },
        select: { id: true, parentId: true },
      });
      const leafByArea = new Map<string, number>();
      for (const g of groups) {
        if (!g.parentId) continue;
        // count this group's own leaf children; a childless group is itself 1 standard.
        const kids = childCount.get(g.id) ?? 0;
        leafByArea.set(g.parentId, (leafByArea.get(g.parentId) ?? 0) + (kids || 1));
      }
      res.json({
        company: { id: company.id, name: company.name },
        totals: {
          areas: areas.length,
          standards: [...leafByArea.values()].reduce((a, b) => a + b, 0),
          withCharter: areas.filter((a) => a.charterIncluded).length,
        },
        standards: areas.map((a) => ({
          id: a.id,
          department: a.department ?? a.name,
          count: leafByArea.get(a.id) ?? a._count.children,
          charterIncluded: !!a.charterIncluded,
          owner: a.ownerLabel,
          link: a.link,
          responsible: a.ownerLabel
            ? [{ label: a.ownerLabel, roleId: null, roleName: a.ownerLabel }]
            : [],
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/standards-flat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      // Flat leaf list = every individual standard. A "leaf" is a non-area Standard
      // with no children (a childless group is itself a leaf); a group WITH children
      // is a container whose children are the leaves. Each leaf carries its AREA id
      // (the area is the leaf's parent if the parent is an area, else the parent
      // group's parent) plus its group name.
      const nonAreas = await prisma.standard.findMany({
        where: { companyId: company.id, isArea: false },
        orderBy: [{ department: 'asc' }, { category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          parentId: true,
          department: true,
          category: true,
          name: true,
          description: true,
          ownerRole: { select: { id: true, displayValue: true } },
          parent: { select: { id: true, isArea: true, name: true, parentId: true } },
        },
      });
      const hasChildren = new Set(nonAreas.map((n) => n.parentId).filter((p): p is string => !!p));
      const items = nonAreas
        .filter((n) => !hasChildren.has(n.id)) // drop container groups; keep leaves + childless groups
        .map((n) => {
          const parentIsArea = n.parent?.isArea ?? false;
          const areaId = parentIsArea ? n.parent!.id : (n.parent?.parentId ?? n.parentId ?? n.id);
          // group = the intermediate group's name; for leaves homed directly under an
          // area (no group tier) fall back to the leaf's own category so the column is
          // never blank.
          const group = parentIsArea ? (n.category ?? null) : (n.parent?.name ?? null);
          return {
            id: n.id,
            areaId,
            department: n.department ?? '—',
            category: n.category ?? '—',
            group,
            name: n.name,
            description: n.description,
            roleId: n.ownerRole?.id ?? null,
            roleName: n.ownerRole?.displayValue ?? null,
          };
        });
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.get('/standards/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const area = await prisma.standard.findFirst({
        where: { id: req.params.id, companyId: company.id, isArea: true },
        select: {
          id: true,
          department: true,
          name: true,
          charterIncluded: true,
          ownerLabel: true,
          link: true,
          mission: true,
          scope: true,
        },
      });
      if (!area) return res.status(404).json({ error: 'Not found' });

      // Top-level rows = the area's direct children (groups). Each group carries its
      // own children as `subs`. A childless group is a standalone leaf standard.
      const groups = await prisma.standard.findMany({
        where: { companyId: company.id, parentId: area.id, isArea: false },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          ...STD_ITEM_SELECT,
          children: { orderBy: { name: 'asc' }, select: STD_ITEM_SELECT },
        },
      });

      const allStdIds = groups.flatMap((g) => [g.id, ...g.children.map((c) => c.id)]);
      // Work Library plan keys per standard: the assigned templates' generic keys
      // (minus suppressed) + item-specific custom keys (testProcedure steps /
      // evidence artifact). Keys only — values are filled in the Work Library.
      const [vsMap, stdLinks, stdAnswers] = await Promise.all([
        vsForStandards(allStdIds),
        prisma.standardWorkTemplate.findMany({
          where: { standardId: { in: allStdIds } },
          select: {
            standardId: true,
            template: {
              select: {
                kind: true,
                sortOrder: true,
                keys: { orderBy: { sortOrder: 'asc' }, select: { id: true, key: true } },
              },
            },
          },
        }),
        prisma.standardTemplateAnswer.findMany({
          where: { standardId: { in: allStdIds } },
          orderBy: { sortOrder: 'asc' },
          select: {
            standardId: true,
            templateKeyId: true,
            customKey: true,
            kind: true,
            suppressed: true,
          },
        }),
      ]);
      // Each key carries `generic` so the UI can call out pattern keys vs
      // item-specific steps distinctly.
      const planFor = (id: string) => {
        const links = stdLinks
          .filter((l) => l.standardId === id)
          .sort((a, b) => a.template.sortOrder - b.template.sortOrder);
        const answers = stdAnswers.filter((a) => a.standardId === id);
        const suppressed = new Set(
          answers
            .filter((a) => a.suppressed && a.templateKeyId)
            .map((a) => a.templateKeyId as string),
        );
        const rows = (kind: 'CHECKLIST' | 'TEST') => [
          ...links
            .filter((l) => l.template.kind === kind)
            .flatMap((l) =>
              l.template.keys
                .filter((k) => !suppressed.has(k.id))
                .map((k) => ({ key: k.key, generic: true })),
            ),
          ...answers
            .filter(
              (a) => !a.templateKeyId && a.customKey && (kind === 'TEST') === (a.kind === 'TEST'),
            )
            .map((a) => ({ key: a.customKey as string, generic: false })),
        ];
        return { checklist: rows('CHECKLIST'), testing: rows('TEST') };
      };

      let leafTotal = 0;
      const categories = new Set<string>();
      let withOwnerRole = 0;
      const items = groups.map((g) => {
        const shaped = shapeItem(g as StdRow, vsMap);
        const subs = g.children.map((c) => ({
          ...shapeItem(c as StdRow, vsMap),
          plan: planFor(c.id),
        }));
        categories.add(shaped.category);
        leafTotal += subs.length || 1;
        if (g.ownerRole) withOwnerRole++;
        for (const c of g.children) if (c.ownerRole) withOwnerRole++;
        return { ...shaped, plan: planFor(g.id), subs };
      });

      res.json({
        area: {
          id: area.id,
          department: area.department ?? area.name,
          count: leafTotal,
          charterIncluded: !!area.charterIncluded,
          owner: area.ownerLabel,
          link: area.link,
          mission: area.mission,
          scope: area.scope,
        },
        totals: {
          items: leafTotal,
          groups: groups.length,
          categories: categories.size,
          withOwnerRole,
        },
        items,
      });
    } catch (e) {
      next(e);
    }
  });
}
