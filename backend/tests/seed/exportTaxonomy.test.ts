// Exporter round-trip: the TTL serialization parses as Turtle statements and
// the nested viewer tree preserves exactly the flat concept count.
import { describe, expect, it } from 'vitest';
import {
  buildViewerTrees,
  countViewerNodes,
  serializeTtl,
  ttlEscape,
  type Concept,
  type Scheme,
} from '../../scripts/export-taxonomy.js';

const concepts: Concept[] = [
  { id: 'pm-coverage-perils', label: 'Coverage & Perils', notation: '2', parentId: null },
  {
    id: 'pma-coverage-perils-exclusions',
    label: 'Exclusions',
    notation: '3',
    parentId: 'pm-coverage-perils',
    scopeNote: 'COMMON',
  },
  {
    id: 'pma-coverage-perils-hired-and-non-owned-auto-ca-20-01',
    label: 'Hired & non-owned auto (CA 20 01) "quoted"',
    notation: '0',
    parentId: 'pm-coverage-perils',
    scopeNote: 'SEGMENT',
    related: ['pm-coverage-perils'],
  },
  // Orphan parent reference → must surface as a root, never be dropped.
  { id: 'pma-orphan', label: 'Orphan\nrow', notation: null, parentId: 'pm-missing' },
];
const scheme: Scheme = { key: 'product-model', label: 'Product model anatomy', concepts };

// Minimal Turtle statement parser: strips comments, splits on statement-ending
// periods, and validates each statement is `subject predicate-object list`.
function parseTurtleStatements(ttl: string): { subject: string; body: string }[] {
  const noComments = ttl
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');
  const statements: { subject: string; body: string }[] = [];
  for (const raw of noComments.split(/\s\.\n/)) {
    const stmt = raw.replace(/\s\.\s*$/, '').trim();
    if (!stmt) continue;
    if (stmt.startsWith('@prefix')) {
      expect(stmt).toMatch(/^@prefix [a-z]+: <[^>]+>$/);
      continue;
    }
    const subject = stmt.split(/\s+/)[0];
    expect(subject, stmt.slice(0, 80)).toMatch(/^tbi:[A-Za-z0-9-]+$/);
    // Every predicate group is ; -separated and quotes are balanced.
    const quotes = stmt.match(/(?<!\\)"/g) ?? [];
    expect(quotes.length % 2, `unbalanced quotes in ${subject}`).toBe(0);
    statements.push({ subject, body: stmt });
  }
  return statements;
}

describe('export-taxonomy serialization', () => {
  it('escapes quotes, backslashes and newlines for Turtle literals', () => {
    expect(ttlEscape('a "b" c')).toBe('a \\"b\\" c');
    expect(ttlEscape('back\\slash')).toBe('back\\\\slash');
    expect(ttlEscape('line\nbreak')).toBe('line\\nbreak');
  });

  it('produces parseable Turtle with one statement per concept plus the scheme', () => {
    const ttl = serializeTtl([scheme], 'ABC Insurance', '2026-07-11');
    const statements = parseTurtleStatements(ttl);
    // 1 ConceptScheme + 4 Concepts.
    expect(statements).toHaveLength(1 + concepts.length);
    const conceptStmts = statements.filter(
      (s) => s.body.includes('a skos:Concept\n') || s.body.includes('a skos:Concept ;'),
    );
    expect(
      conceptStmts.length +
        statements.filter((s) => s.body.includes('a skos:ConceptScheme')).length,
    ).toBe(statements.length);
    // Contract URIs and SKOS shape.
    const ca = statements.find(
      (s) => s.subject === 'tbi:pma-coverage-perils-hired-and-non-owned-auto-ca-20-01',
    );
    expect(ca?.body).toContain('skos:broader tbi:pm-coverage-perils');
    expect(ca?.body).toContain('skos:scopeNote "SEGMENT"@en');
    expect(ca?.body).toContain('skos:related tbi:pm-coverage-perils');
    const top = statements.find((s) => s.subject === 'tbi:pm-coverage-perils');
    expect(top?.body).toContain('skos:topConceptOf tbi:scheme-product-model');
  });

  it('viewer tree node count equals the flat concept count (orphans become roots)', () => {
    const trees = buildViewerTrees(concepts);
    expect(countViewerNodes(trees)).toBe(concepts.length);
    // Two roots: the component top concept and the orphan.
    expect(trees).toHaveLength(2);
    const component = trees.find((t) => t.l === 'Coverage & Perils');
    expect(component?.c).toHaveLength(2);
    expect(component?.c.map((n) => n.e?.scope).sort()).toEqual(['COMMON', 'SEGMENT']);
  });

  it('round-trips: every concept in the TTL appears exactly once in the viewer tree', () => {
    const ttl = serializeTtl([scheme], 'ABC Insurance', '2026-07-11');
    const ttlConceptIds = [...ttl.matchAll(/^tbi:([A-Za-z0-9-]+) a skos:Concept ;$/gm)].map(
      (m) => m[1],
    );
    expect(ttlConceptIds.sort()).toEqual(concepts.map((c) => c.id).sort());
    expect(countViewerNodes(buildViewerTrees(concepts))).toBe(ttlConceptIds.length);
  });
});
