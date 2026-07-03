/**
 * Build per-role research input packets for the role-profile enrichment
 * (documents/role-research/packets/batch-NN.json, 15 roles per batch).
 *
 * Reads COMMITTED sources only — no DB:
 *   data/seed/org-from-develop.json   — the canonical 299-role roster, org homes,
 *                                       priors (roleFamily/roleLevel/description)
 *   data/seed/master_v5.json          — nodeRole (taskKey paths + Owner/Participant),
 *                                       deliverables (l4Key → title)
 *   data/seed/spine.json              — roleValueStreams (Lead/Support + I/O)
 *   documents/value-streams/_master_build/role_tasks.json — responsibilities (all 299)
 *
 * Also emits documents/role-research/org-catalog.json (division/department
 * catalog + roleFamily/roleLevel vocab) for embedding in research prompts.
 *
 * Run: npx tsx --env-file=.env scripts/build-role-research-packets.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidates } from '../src/lib/roleMatch.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const OUT_DIR = resolve(repo, 'documents/role-research/packets');
const BATCH_SIZE = 15;

type DevelopRole = {
  name: string;
  division: string | null;
  department: string | null;
  roleLevel: string | null;
  roleFamily: string | null;
  description: string | null;
};
type Develop = {
  divisions: { name: string }[];
  departments: { name: string; division?: string | null }[];
  roles: DevelopRole[];
};
type Master = {
  roles: { dbValue: string }[];
  nodeRole: { taskKey: string; roleDbValue: string; role: string; ownerLevel: string | null }[];
  deliverables: { l4Key: string; title: string }[];
};
type Spine = {
  roleValueStreams: {
    roleName: string;
    valueStreamName: string;
    participationType: string | null;
  }[];
};

type Packet = {
  roleName: string;
  orgHome: { division: string; department: string | null } | null;
  valueStreams: { name: string; relation: 'Lead' | 'Support' }[];
  sampleTasks: { task: string; l4: string; relation: 'Owner' | 'Participant' }[];
  deliverables: string[];
  responsibilities: string[];
  priors: { roleFamily: string | null; roleLevel: string | null; description: string | null };
  counts: { tasks: number; ownerTasks: number; deliverables: number };
};

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function main() {
  const develop = JSON.parse(
    readFileSync(resolve(here, '../data/seed/org-from-develop.json'), 'utf8'),
  ) as Develop;
  const master = JSON.parse(
    readFileSync(resolve(here, '../data/seed/master_v5.json'), 'utf8'),
  ) as Master;
  const spine = JSON.parse(readFileSync(resolve(here, '../data/seed/spine.json'), 'utf8')) as Spine;
  const roleTasks = JSON.parse(
    readFileSync(resolve(repo, 'documents/value-streams/_master_build/role_tasks.json'), 'utf8'),
  ) as Record<string, string[]>;

  // Alias index: every candidates() token of a develop role name → canonical name.
  // Used to fold master/spine/role_tasks rows (keyed by their own spellings)
  // onto the 299-role roster.
  const aliasToRole = new Map<string, string>();
  for (const r of develop.roles) {
    for (const c of candidates(r.name)) if (!aliasToRole.has(c)) aliasToRole.set(c, r.name);
  }
  const toCanonical = (name: string): string | null => {
    for (const c of candidates(name)) {
      const hit = aliasToRole.get(c);
      if (hit) return hit;
    }
    return null;
  };

  // ── master nodeRole → tasks / value streams / deliverable l4Keys per role ──
  const deliverableByL4 = new Map(master.deliverables.map((d) => [d.l4Key, d.title]));
  type TaskRow = {
    task: string;
    l4: string;
    l4Key: string;
    vs: string;
    relation: 'Owner' | 'Participant';
  };
  const tasksByRole = new Map<string, TaskRow[]>();
  let unmatchedNodeRoleNames = new Set<string>();
  for (const nr of master.nodeRole) {
    const canonical = toCanonical(nr.roleDbValue);
    if (!canonical) {
      unmatchedNodeRoleNames.add(nr.roleDbValue);
      continue;
    }
    const parts = nr.taskKey.split('/');
    if (parts.length < 5) continue;
    const row: TaskRow = {
      task: titleCase(parts[4]),
      l4: titleCase(parts[3]),
      l4Key: parts.slice(0, 4).join('/'),
      vs: titleCase(parts[1]),
      relation: nr.role === 'Owner' ? 'Owner' : 'Participant',
    };
    const list = tasksByRole.get(canonical);
    if (list) list.push(row);
    else tasksByRole.set(canonical, [row]);
  }

  // ── spine roleValueStreams (display names + Lead/Support) per role ──
  const spineVsByRole = new Map<string, Map<string, 'Lead' | 'Support'>>();
  for (const rvs of spine.roleValueStreams) {
    const canonical = toCanonical(rvs.roleName);
    if (!canonical) continue;
    const rel: 'Lead' | 'Support' = rvs.participationType === 'Lead' ? 'Lead' : 'Support';
    const m = spineVsByRole.get(canonical) ?? new Map<string, 'Lead' | 'Support'>();
    if (m.get(rvs.valueStreamName) !== 'Lead') m.set(rvs.valueStreamName, rel);
    spineVsByRole.set(canonical, m);
  }

  // ── responsibilities per role (role_tasks.json keys are the develop names) ──
  const respByRole = new Map<string, string[]>();
  for (const [name, items] of Object.entries(roleTasks)) {
    const canonical = toCanonical(name);
    if (canonical) respByRole.set(canonical, items);
  }

  // ── assemble packets ──
  const packets: Packet[] = develop.roles
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => {
      const rows = tasksByRole.get(r.name) ?? [];

      // Strongest relation per VS from task links; spine rows fill display names
      // and cover the 42 imported roles that have no task links.
      const vsRel = new Map<string, 'Lead' | 'Support'>();
      for (const row of rows) {
        const rel = row.relation === 'Owner' ? 'Lead' : 'Support';
        if (vsRel.get(row.vs) !== 'Lead') vsRel.set(row.vs, rel);
      }
      for (const [vs, rel] of spineVsByRole.get(r.name) ?? []) {
        if (vsRel.get(vs) !== 'Lead') vsRel.set(vs, rel);
      }

      // Sample tasks: stratified across value streams, Owners first, ≤10.
      const byVs = new Map<string, TaskRow[]>();
      for (const row of rows) {
        const list = byVs.get(row.vs) ?? [];
        list.push(row);
        byVs.set(row.vs, list);
      }
      const sampleTasks: Packet['sampleTasks'] = [];
      const vsLists = [...byVs.values()].map((l) =>
        l.slice().sort((a, b) => (a.relation === b.relation ? 0 : a.relation === 'Owner' ? -1 : 1)),
      );
      for (let i = 0; sampleTasks.length < 10; i++) {
        let added = false;
        for (const list of vsLists) {
          if (i < list.length && sampleTasks.length < 10) {
            sampleTasks.push({ task: list[i].task, l4: list[i].l4, relation: list[i].relation });
            added = true;
          }
        }
        if (!added) break;
      }

      const deliverables = [
        ...new Set(
          rows
            .filter((row) => row.relation === 'Owner')
            .map((row) => deliverableByL4.get(row.l4Key))
            .filter((t): t is string => Boolean(t)),
        ),
      ];

      return {
        roleName: r.name,
        orgHome: r.division ? { division: r.division, department: r.department } : null,
        valueStreams: [...vsRel.entries()].map(([name, relation]) => ({ name, relation })),
        sampleTasks,
        deliverables: deliverables.slice(0, 10),
        responsibilities: (respByRole.get(r.name) ?? []).slice(0, 8),
        priors: { roleFamily: r.roleFamily, roleLevel: r.roleLevel, description: r.description },
        counts: {
          tasks: rows.length,
          ownerTasks: rows.filter((row) => row.relation === 'Owner').length,
          deliverables: deliverables.length,
        },
      };
    });

  mkdirSync(OUT_DIR, { recursive: true });
  let batchCount = 0;
  for (let i = 0; i < packets.length; i += BATCH_SIZE) {
    batchCount++;
    const nn = String(batchCount).padStart(2, '0');
    writeFileSync(
      resolve(OUT_DIR, `batch-${nn}.json`),
      JSON.stringify({ batch: batchCount, roles: packets.slice(i, i + BATCH_SIZE) }, null, 2),
    );
  }

  // Org catalog + controlled vocab for the research prompts.
  const familyVocab = [...new Set(develop.roles.map((r) => r.roleFamily).filter(Boolean))].sort();
  const levelVocab = [...new Set(develop.roles.map((r) => r.roleLevel).filter(Boolean))].sort();
  writeFileSync(
    resolve(repo, 'documents/role-research/org-catalog.json'),
    JSON.stringify(
      {
        divisions: develop.divisions.map((d) => d.name),
        departments: develop.departments.map((d) => ({
          name: d.name,
          division: d.division ?? null,
        })),
        roleFamilyVocab: familyVocab,
        roleLevelVocab: levelVocab,
      },
      null,
      2,
    ),
  );

  const unhomed = packets.filter((p) => !p.orgHome).map((p) => p.roleName);
  const noTasks = packets.filter((p) => p.counts.tasks === 0).length;
  console.log(`packets: ${packets.length} roles → ${batchCount} batches (size ${BATCH_SIZE})`);
  console.log(
    `un-homed (need proposedOrgUnit): ${unhomed.length}${unhomed.length ? ' — ' + unhomed.join(', ') : ''}`,
  );
  console.log(`roles with no task links: ${noTasks}`);
  if (unmatchedNodeRoleNames.size > 0) {
    console.log(
      `⚠ nodeRole names not matched to roster (${unmatchedNodeRoleNames.size}):`,
      [...unmatchedNodeRoleNames].slice(0, 10).join(' | '),
    );
  }
}

main();
