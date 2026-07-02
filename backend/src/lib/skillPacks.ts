import { prisma } from '../db/prisma.js';
import { vsForStandards } from './govRollup.js';

// ─── Generated SDLC skill packs (single source of truth) ─────────────────────
// The per-category compliance skill packs are a PURE FUNCTION of the company's
// Standard rows + the templates below. We do NOT store the generated markdown
// anywhere (disk or DB) — the route builds it on demand from this module. The
// only per-skill "differences" are the Standard rows (already in the DB); the
// "identical parts" are the templates here, kept as a single copy.
//
// The five hand-authored packs in KEEP are NOT derivable; their files are served
// from the SkillFile table instead (see routes/standardsSkills.ts).

// Hand-authored SDLC packs kept as-is (regulation regimes + cross-cutting).
export const KEEP = new Set([
  'ccpa-cpra-sdlc-compliance',
  'gdpr-sdlc-compliance',
  'nydfs-500-sdlc-compliance',
  'sox-itgc-sdlc-compliance',
  'acord-data-standards-compliance',
]);

// The [^a-z0-9]+ pass collapses every non-alnum run to ONE dash, so at most a
// single leading/trailing dash can remain — ^-|-$ is equivalent to ^-+|-+$.
const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstSentence = (s: string | null) => (s ? (s.split(/(?<=[.;])\s/)[0] || s).trim() : '');
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const skillName = (category: string) => `${slug(category)}-sdlc-compliance`;
const uniq = <T>(a: T[]) => [...new Set(a)];

export type Control = {
  name: string; description: string; testProcedure: string | null; evidence: string | null;
  ownerLabel: string | null; buildRun: string | null; regCitation: string | null; department: string; valueStreams: string[];
};
export type Grouping = { category: string; departments: string[]; controls: Control[] };

function areaPhrase(g: Grouping): string {
  return g.departments.length === 1 ? `the ${g.departments[0]} area` : `the ${g.departments.slice(0, -1).join(', ')} and ${g.departments[g.departments.length - 1]} areas`;
}

// ── SKILL.md ────────────────────────────────────────────────────────────────
function skillMd(g: Grouping, name: string): string {
  const owners = uniq(g.controls.map((c) => c.ownerLabel).filter(Boolean) as string[]);
  const ownerLine = owners.length ? owners.slice(0, 5).join(', ') + (owners.length > 5 ? ', …' : '') : 'the area owner';
  const names = g.controls.map((c) => c.name);
  const sampleNames = names.slice(0, 8).map(lc).join(', ') + (names.length > 8 ? ', and more' : '');
  const vs = uniq(g.controls.flatMap((c) => c.valueStreams)).slice(0, 6);
  return `---
name: ${name}
description: >
  Enforce and evidence the ${g.category} standards (${g.controls.length} controls spanning ${areaPhrase(g)},
  owned by ${ownerLine}) across the software delivery lifecycle — requirements, design, development, and
  testing — for any system that implements, feeds, or reports ${lc(g.category)} work. Use this skill
  whenever delivery work touches ${sampleNames}. Also use when writing user stories, designs, APIs, or
  test plans for these systems, and whenever the goal is audit-ready evidence that a ${lc(g.category)}
  control is met. When unsure whether the control is in scope, run the scope gate rather than skipping it.
---

# ${g.category} Across the SDLC — Controls and Audit Evidence

## What this skill does

The **${g.category}** grouping defines **${g.controls.length} standards** (across ${areaPhrase(g)}), each an
independently testable rule with a named evidence artifact. This skill turns those controls into **SDLC
gates** and, for each gate, names the evidence to produce — so the capability is provable in an audit.

Each control's source obligation is in \`references/${slug(g.category)}-reference.md\`; a one-line cheat
sheet is in \`references/${slug(g.category)}-quick-reference.md\`; the control→evidence crosswalk is in
\`references/audit-evidence-map.md\`.

## Operating principle (read once, apply always)

> **A ${lc(g.category)} control nobody can evidence is an intention, not a control.** Every standard in this
> grouping must trace to a concrete verification and the artifact it leaves behind — build the evidence in,
> don't reconstruct it at audit time.

Maintain one **${g.category} Compliance Record** per feature/system. The four gates write into it.

## STEP 0 — Scope gate (always run first)

1. **Does the system implement, feed, or report ${lc(g.category)} work?**
2. **Which of these controls does it touch?** ${names.slice(0, 12).join(' · ')}${names.length > 12 ? ' · …' : ''}
3. **Who owns the controls in scope?** ${ownerLine}.
${vs.length ? `4. **Which value streams does it run in?** ${vs.join(' · ')}.` : ''}

- If **no control in scope** → record the determination and stop.
- If **unsure** → treat as in-scope and escalate to ${owners[0] ?? 'the area owner'}.

## The four phase gates

Each gate lists the controls to apply and the evidence each leaves. A phase isn't "done" until its
evidence exists in the ${g.category} Compliance Record.

1. **Requirements** → \`references/requirements-phase.md\` — specify + baseline each control and its acceptance criteria.
2. **Design** → \`references/design-phase.md\` — bake each control into the design so its evidence is producible.
3. **Development** → \`references/development-phase.md\` — implement each control and emit its evidence.
4. **Testing** → \`references/testing-phase.md\` — run each control's verification and capture the evidence.

## How to use this skill in practice
- **Reviewing/authoring an artifact:** load the matching phase reference, run its checklist, write missing
  items + evidence pointers into the ${g.category} Compliance Record.
- **New feature kickoff:** run STEP 0, then walk all four gates.
- **Audit prep:** open \`references/audit-evidence-map.md\`; confirm every control has stored, in-date evidence.

## Boundaries
Engineering guidance, not a substitute for the owning function's professional judgement. This skill
enforces build-time controls and produces evidence; the owning roles (${ownerLine}) make the substantive calls.
`;
}

// ── Phase files ───────────────────────────────────────────────────────────────
const PHASES = {
  requirements: {
    title: 'Requirements',
    intro: 'What the agent enforces and the evidence to capture during requirements. For each control, specify it as a requirement and define its acceptance criteria.',
    bullet: (c: Control) => `- **${c.name}** — capture as a requirement: ${firstSentence(c.description) || c.name}\n  - **Acceptance / evidence:** ${c.evidence ?? 'documented control implementation with sign-off.'}`,
  },
  design: {
    title: 'Design',
    intro: 'Controls the agent bakes into the design, with the evidence to capture. Design each control so its evidence is producible by construction.',
    bullet: (c: Control) => `- **${c.name}** — design in the control: ${firstSentence(c.description) || c.name}\n  - **Evidence by design:** ${c.evidence ?? 'design-decision record referencing the control.'}`,
  },
  development: {
    title: 'Development',
    intro: 'Build-time controls the agent checks, with the evidence to capture. Implement each control and emit its evidence as a side effect of normal operation.',
    bullet: (c: Control) => `- **${c.name}** — implement and instrument${c.ownerLabel ? ` (owner: ${c.ownerLabel})` : ''}.\n  - **Evidence:** ${c.evidence ?? 'control→code mapping with reviewer approval.'}`,
  },
  testing: {
    title: 'Testing',
    intro: 'Tests the agent uses to prove the controls, with the evidence to capture. Each control carries a concrete verification.',
    bullet: (c: Control) => `- **${c.name}**\n  - **Test:** ${c.testProcedure ?? 'verify the control meets its acceptance criteria.'}\n  - **Evidence:** ${c.evidence ?? 'documented result with sign-off.'}`,
  },
} as const;

function phaseMd(g: Grouping, phase: keyof typeof PHASES): string {
  const p = PHASES[phase];
  return `# ${g.category} — ${p.title} Phase\n\n${p.intro}\n\nGrouping: **${g.category}** · ${areaPhrase(g)} · ${g.controls.length} controls.\n\n## Controls\n\n${g.controls.map(p.bullet).join('\n')}\n`;
}

function quickRefMd(g: Grouping): string {
  return `# ${g.category} — Quick Reference\n\nOne line per control: area · build/run · owning role · the evidence that proves it. Full detail is in the phase files and \`audit-evidence-map.md\`.\n\n${g.controls
    .map((c) => `- **${c.name}** — ${c.department} · ${c.buildRun ?? 'Build/Run'} · ${c.ownerLabel ?? 'area owner'} · ${c.evidence ? lc(c.evidence) : 'documented evidence with sign-off.'}`)
    .join('\n')}\n`;
}

function referenceMd(g: Grouping): string {
  return `# ${g.category} — Source Reference\n\nThe underlying obligation behind each ${g.category} control — the "why" the gate enforces. Cite from it in reviews and evidence.\n\n${g.controls
    .map((c) => `## ${c.name}\n${c.description || c.name}\n\n**Area:** ${c.department}${c.regCitation ? `  ·  **Citation:** ${c.regCitation}` : ''}${c.ownerLabel ? `  ·  **Owner:** ${c.ownerLabel}` : ''}`)
    .join('\n\n')}\n`;
}

function auditMapMd(g: Grouping): string {
  const phaseOf = (c: Control) => (c.buildRun === 'Run' ? 'Testing / Run' : 'Development');
  return `# ${g.category} — Audit Evidence Map\n\nEach ${g.category} control → the evidence artifact that proves it, the verification that produces it, and the owning role. Assemble these into the ${g.category} Compliance Record before an audit.\n\n| Control | Area | Owner | Verification (test) | Evidence artifact | Phase |\n|---|---|---|---|---|---|\n${g.controls
    .map((c) => `| ${c.name} | ${c.department} | ${c.ownerLabel ?? '—'} | ${(c.testProcedure ?? 'verify against acceptance criteria').replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${(c.evidence ?? 'documented control evidence').replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${phaseOf(c)} |`)
    .join('\n')}\n`;
}

// ─── Per-standard skill packs (one control = one tailored skill) ─────────────
// Each leaf Standard can carry its OWN agent skill (Standard.agentSkill), tailored
// to enforcing + testing that single control across the SDLC. Like the category
// packs these are a PURE FUNCTION of the Standard row (+ its owner/appliers/value
// streams/test/evidence) — nothing is stored; the route builds them on demand.

// Deterministic, resolvable slug: <department>-<category>-<name>. Unique per
// company (a name repeats across categories, so category disambiguates); matched
// back via Standard.agentSkill.
export const standardSkillName = (department: string | null, category: string | null, name: string) =>
  [department, category, name].map((p) => slug(p ?? '')).filter(Boolean).join('-').slice(0, 140);

export type StandardControl = {
  id: string; name: string; description: string; category: string | null; department: string | null;
  buildRun: string | null; regCitation: string | null; testProcedure: string | null; evidence: string | null;
  ownerLabel: string | null; ownerRole: string | null; appliers: string[]; valueStreams: string[];
};

function standardSkillMd(c: StandardControl, name: string): string {
  const steps = (c.testProcedure ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const vs = uniq(c.valueStreams);
  const appliers = uniq(c.appliers);
  const owner = c.ownerRole ?? c.ownerLabel ?? 'the area owner';
  const phase = c.buildRun === 'Run' ? 'operational (Run)' : 'build-time (Build)';
  return `---
name: ${name}
description: >
  Enforce and evidence the single control "${c.name}"${c.category ? ` (${c.category})` : ''} across the software
  delivery lifecycle — requirements, design, development, and testing. Use this skill whenever delivery or
  operations work touches ${lc(c.category ?? c.name)}${vs.length ? ` in the ${vs.slice(0, 3).join(', ')} value stream(s)` : ''},
  or whenever the goal is audit-ready proof that "${c.name}" is met. When unsure whether it is in scope, run
  the scope gate rather than skipping it.
---

# ${c.name}

**Control** · ${c.department ?? '—'}${c.category ? ` · ${c.category}` : ''} · ${phase}${c.regCitation ? ` · Citation: ${c.regCitation}` : ''}

## What this control requires
${c.description || c.name}

## Who
- **Accountable owner:** ${owner} — makes the substantive calls and signs off.
- **Applied by:** ${appliers.length ? appliers.join(', ') : 'the delivery/operations team'} — implements and evidences it day-to-day.
${vs.length ? `- **Governs value stream(s):** ${vs.join(', ')}.` : ''}

## STEP 0 — Scope gate (always run first)
1. Does the system/change implement, feed, or report **${lc(c.category ?? c.name)}**?
2. If **no** → record the determination and stop. If **unsure** → treat as in-scope and escalate to ${owner}.

## Build it in (requirements → design → development)
- **Requirements:** capture "${c.name}" as an explicit, testable requirement with its acceptance criteria = the verification below.
- **Design:** design the control in so its evidence is producible by construction — not reconstructed at audit time.
- **Development:** implement it and emit its evidence as a side effect of normal operation.

## Verify it (testing / audit)
Run these steps; the control is **not met** until every step passes and the evidence exists.

${steps.length ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '1. Confirm the control meets its acceptance criteria for the in-scope systems, with an accountable owner.'}

## Evidence to capture
> ${c.evidence ?? 'Documented control implementation with a reviewer sign-off and the date it was last verified.'}

## Boundary
Engineering + operational enforcement and evidence — not a substitute for ${owner}'s professional judgement.
`;
}

function standardReferenceMd(c: StandardControl): string {
  return `# ${c.name} — Source Reference\n\nThe obligation this control enforces — cite from it in reviews and evidence.\n\n${c.description || c.name}\n\n**Area:** ${c.department ?? '—'}${c.category ? `  ·  **Category:** ${c.category}` : ''}${c.regCitation ? `  ·  **Citation:** ${c.regCitation}` : ''}\n**Owner:** ${c.ownerRole ?? c.ownerLabel ?? '—'}${c.appliers.length ? `  ·  **Applied by:** ${uniq(c.appliers).join(', ')}` : ''}${c.valueStreams.length ? `  ·  **Value streams:** ${uniq(c.valueStreams).join(', ')}` : ''}\n`;
}

// Render one standard into its pack files. Pure function of the control.
export function generatedStandardPackFiles(c: StandardControl): { path: string; content: string }[] {
  const name = standardSkillName(c.department, c.category, c.name);
  return [
    { path: 'SKILL.md', content: standardSkillMd(c, name) },
    { path: `references/${slug(c.name)}-reference.md`, content: standardReferenceMd(c) },
  ];
}

// Resolve a per-standard skill by its slug (Standard.agentSkill match). Returns
// the shaped control (for pack rendering), or null if no leaf carries that slug.
export async function findStandardSkill(companyId: string, skill: string): Promise<StandardControl | null> {
  const s = await prisma.standard.findFirst({
    where: { companyId, isArea: false, agentSkill: skill },
    select: {
      id: true, name: true, description: true, category: true, department: true, buildRun: true,
      regCitation: true, testProcedure: true, evidence: true, ownerLabel: true,
      ownerRole: { select: { displayValue: true } },
      roleStandards: { select: { role: { select: { displayValue: true } } } },
    },
  });
  if (!s) return null;
  // Standards attach to task nodes; value streams roll up via the closure.
  const vs = (await vsForStandards([s.id])).get(s.id) ?? [];
  return {
    id: s.id, name: s.name, description: s.description ?? '', category: s.category, department: s.department,
    buildRun: s.buildRun, regCitation: s.regCitation, testProcedure: s.testProcedure, evidence: s.evidence,
    ownerLabel: s.ownerLabel, ownerRole: s.ownerRole?.displayValue ?? null,
    appliers: s.roleStandards.map((r) => r.role?.displayValue).filter((v): v is string => !!v),
    valueStreams: vs.map((v) => v.name),
  };
}

// ── Build groupings from the DB (the per-skill "differences") ─────────────────
export async function buildGroupings(companyId: string): Promise<Grouping[]> {
  const nonAreas = await prisma.standard.findMany({
    where: { companyId, isArea: false },
    select: {
      id: true, name: true, description: true, department: true, category: true, parentId: true,
      testProcedure: true, evidence: true, ownerLabel: true, buildRun: true, regCitation: true,
    },
  });
  const hasChildren = new Set(nonAreas.map((n) => n.parentId).filter((p): p is string => !!p));
  const leaves = nonAreas.filter((n) => !hasChildren.has(n.id) && n.department && n.category);
  // Standards attach to task nodes; value streams roll up via the closure.
  const vsMap = await vsForStandards(leaves.map((l) => l.id));

  const byCat = new Map<string, Grouping>();
  for (const l of leaves) {
    const cat = l.category!;
    if (!byCat.has(cat)) byCat.set(cat, { category: cat, departments: [], controls: [] });
    const g = byCat.get(cat)!;
    if (!g.departments.includes(l.department!)) g.departments.push(l.department!);
    g.controls.push({
      name: l.name, description: l.description ?? '', testProcedure: l.testProcedure, evidence: l.evidence,
      ownerLabel: l.ownerLabel, buildRun: l.buildRun, regCitation: l.regCitation, department: l.department!,
      valueStreams: (vsMap.get(l.id) ?? []).map((v) => v.name),
    });
  }
  for (const g of byCat.values()) g.departments.sort();
  // A category whose skill name collides with a hand-authored KEEP pack is owned
  // by that pack, not generated here.
  return [...byCat.values()].filter((g) => !KEEP.has(skillName(g.category)));
}

// ── Render a grouping into its (path, content) pack files ─────────────────────
export function generatedPackFiles(g: Grouping): { path: string; content: string }[] {
  const cat = slug(g.category);
  return [
    { path: 'SKILL.md', content: skillMd(g, skillName(g.category)) },
    { path: 'references/requirements-phase.md', content: phaseMd(g, 'requirements') },
    { path: 'references/design-phase.md', content: phaseMd(g, 'design') },
    { path: 'references/development-phase.md', content: phaseMd(g, 'development') },
    { path: 'references/testing-phase.md', content: phaseMd(g, 'testing') },
    { path: `references/${cat}-quick-reference.md`, content: quickRefMd(g) },
    { path: `references/${cat}-reference.md`, content: referenceMd(g) },
    { path: 'references/audit-evidence-map.md', content: auditMapMd(g) },
  ];
}
