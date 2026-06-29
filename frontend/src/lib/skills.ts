// Friendly display names for compliance agent skills. The underlying skill
// identifier (and folder / DB value) stays the kebab-case slug; this is purely
// how we present it in the UI. "sdlc" is dropped from display names — the slugs
// keep it ("actuarial-sdlc-compliance" → "Actuarial Compliance").

const SKILL_LABELS: Record<string, string> = {
  'gdpr-sdlc-compliance': 'GDPR Compliance',
  'ccpa-cpra-sdlc-compliance': 'CCPA/CPRA Compliance',
  'nydfs-500-sdlc-compliance': 'NYDFS 500 Compliance',
};

const ACRONYMS = new Set(['gdpr', 'ccpa', 'cpra', 'nydfs', 'iso', 'soc', 'pci', 'hipaa', 'dora', 'cat', 'pmo', 'sast', 'dast', 'sca', 'siem', 'mfa', 'rbac', 'pam', 'dpia', 'ropa', 'kpi', 'sla', 'api']);

// Per-grouping skill slugs are the category only (no standards area), e.g.
// "pricing-sdlc-compliance" → "Pricing Compliance".
export function skillLabel(slug: string): string {
  if (SKILL_LABELS[slug]) return SKILL_LABELS[slug];
  return slug
    .split('-')
    .filter((w) => w !== 'sdlc')
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// ─── Skill file descriptions ─────────────────────────────────────────────────
// Turns a skill pack's raw file paths into clear names + a one-line "how the
// agent uses it", grouped for the viewer. Meta files that aren't part of the
// agent skill (README, integration notes) are hidden.

export type SkillFileInfo = { group: string; label: string; description: string; hidden?: boolean };

export const SKILL_FILE_GROUP_ORDER = ['Agent skill', 'SDLC phase playbooks', 'References', 'Standards data', 'Other'];

export function describeSkillFile(path: string): SkillFileInfo {
  const p = path.toLowerCase();
  const base = p.split('/').pop() ?? p;

  if (base === 'skill.md')
    return { group: 'Agent skill', label: 'Skill definition', description: 'The skill the agent loads — when to use it and the gate-by-gate procedure it follows.' };

  // Project / onboarding docs — not part of the agent skill.
  if (base === 'readme.md' || base === 'integration-notes.md')
    return { group: '', label: base, description: '', hidden: true };

  if (/requirements-phase\.md$/.test(p)) return { group: 'SDLC phase playbooks', label: 'Requirements phase', description: 'What the agent enforces and the evidence to capture during requirements.' };
  if (/design-phase\.md$/.test(p)) return { group: 'SDLC phase playbooks', label: 'Design phase', description: 'Controls the agent bakes into the design, with the evidence to capture.' };
  if (/development-phase\.md$/.test(p)) return { group: 'SDLC phase playbooks', label: 'Development phase', description: 'Build-time controls the agent checks, with the evidence to capture.' };
  if (/testing-phase\.md$/.test(p)) return { group: 'SDLC phase playbooks', label: 'Testing phase', description: 'Tests the agent uses to prove the controls, with the evidence to capture.' };

  if (/audit-evidence-map\.md$/.test(p)) return { group: 'References', label: 'Audit evidence map', description: 'Maps each control to the evidence artifact that proves it in an audit.' };
  if (/quick-reference\.md$/.test(p)) return { group: 'References', label: 'Citation quick reference', description: 'One-line-per-article/section cheat sheet the agent cites from.' };
  if (/-reference\.md$/.test(p)) return { group: 'References', label: 'Regulation source reference', description: 'The underlying regulatory obligations the skill is built from.' };

  if (/\.json$/.test(p)) return { group: 'Standards data', label: 'Standards dataset (JSON)', description: 'The standards this skill enforces, structured for import.' };
  if (/\.csv$/.test(p)) return { group: 'Standards data', label: 'Standards dataset (CSV)', description: 'The standards this skill enforces, spreadsheet form.' };

  return { group: 'Other', label: path, description: '' };
}
