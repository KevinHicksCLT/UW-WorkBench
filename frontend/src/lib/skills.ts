// Friendly display names for SDLC compliance agent skills. The underlying skill
// identifier (and folder / DB value) stays the kebab-case slug; this is purely
// how we present it in the UI.

const SKILL_LABELS: Record<string, string> = {
  'gdpr-sdlc-compliance': 'GDPR SDLC Compliance',
  'ccpa-cpra-sdlc-compliance': 'CCPA/CPRA SDLC Compliance',
  'nydfs-500-sdlc-compliance': 'NYDFS 500 SDLC Compliance',
};

const ACRONYMS = new Set(['gdpr', 'ccpa', 'cpra', 'nydfs', 'sdlc', 'iso', 'soc', 'pci', 'hipaa', 'dora']);

export function skillLabel(slug: string): string {
  if (SKILL_LABELS[slug]) return SKILL_LABELS[slug];
  return slug
    .split('-')
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
