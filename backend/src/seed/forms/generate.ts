// ── Synthetic family generator (SCRUM-229) ──
// Turns the anchor manuscripts + the declarative family recipe into concrete
// form sourceTexts. A variant clause marked `same` reuses the anchor's exact
// segmented clause text, so it normalizes/hashes identically and the clustering
// short-circuit fires — the controlled divergence (reword / limit / drop / add)
// is the only thing that moves similarity. Deterministic and dependency-free.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentClauses } from '../../lib/forms/segmentation.js';
import { FAMILIES, type Family, type VariantSpec } from './families.js';

const here = dirname(fileURLToPath(import.meta.url));
// backend/src/seed/forms → backend/data/forms/manuscripts.json
const MANIFEST_PATH = resolve(here, '../../../data/forms/manuscripts.json');

export type Manuscript = {
  formNumber: string;
  title: string;
  lob: string;
  kind: 'form' | 'endorsement';
  editionDate: string;
  states: string[] | null;
  filingStatus: string;
  provenance: string;
  sourceText: string;
  schedules?: { ref: string; describes: string }[];
  limits?: { name: string; amount: number | null; basis: string }[];
  modifies?: string;
};

export type BuiltForm = {
  familyKey: string;
  anchorFormNumber: string;
  isAnchor: boolean;
  role: string; // 'anchor' | core | regional | outlier | product | superseded
  formNumber: string;
  title: string;
  lob: string;
  kind: 'form' | 'endorsement';
  states: string[] | null;
  editionDate: string;
  filingStatus: string;
  provenance: string;
  sourceText: string;
  note?: string;
};

/**
 * A recipe-derived signal used to author an explicit, citation-backed finding
 * on top of the cluster run (the cluster/outlier findings come from clustering;
 * these carry the "materially divergent" and "missing clause" claims).
 */
export type FamilyMarker =
  | {
      kind: 'materially-divergent';
      familyKey: string;
      formNumber: string;
      anchorFormNumber: string;
      clauseHeading: string;
      detail: string;
      confidence: number;
    }
  | {
      kind: 'missing-clause';
      familyKey: string;
      formNumber: string;
      anchorFormNumber: string;
      clauseHeading: string;
      presentIn: string[];
      confidence: number;
    };

export type BuiltFamily = {
  family: Family;
  anchor: Manuscript;
  forms: BuiltForm[]; // anchor first, then variants
  markers: FamilyMarker[];
};

/** Heading of the anchor's clause at a given index (0 = title). */
function anchorHeadingAt(anchorSourceText: string, index: number): string {
  const clauses = segmentClauses(anchorSourceText);
  const c = clauses[index];
  if (!c) return `clause ${index}`;
  return c.heading ?? c.text.split('\n')[0];
}

let manifestCache: { provenance: string; manuscripts: Manuscript[] } | null = null;

export function loadManuscripts(): Manuscript[] {
  if (!manifestCache) {
    manifestCache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  }
  return manifestCache!.manuscripts;
}

/** Build the variant sourceText from the anchor's segmented clause texts. */
function buildVariantSourceText(anchorClauseTexts: string[], spec: VariantSpec): string {
  const out: string[] = [];
  for (let i = 0; i < anchorClauseTexts.length; i++) {
    const op = spec.ops?.[i];
    if (i === 0) {
      // Title clause is always carried verbatim (keeps the title cluster hash-equal).
      out.push(anchorClauseTexts[i]);
      continue;
    }
    if (!op || op.kind === 'same') {
      out.push(anchorClauseTexts[i]);
    } else if (op.kind === 'reword' || op.kind === 'limit') {
      out.push(op.text.trim());
    } // op.kind === 'drop' → omit
  }
  for (const added of spec.add ?? []) out.push(added.text.trim());
  return out.join('\n');
}

export function buildFamilies(): BuiltFamily[] {
  const byNumber = new Map(loadManuscripts().map((m) => [m.formNumber, m]));
  const built: BuiltFamily[] = [];
  for (const family of FAMILIES) {
    const anchor = byNumber.get(family.anchorFormNumber);
    if (!anchor) throw new Error(`Manuscript anchor not found: ${family.anchorFormNumber}`);
    const anchorClauseTexts = segmentClauses(anchor.sourceText).map((c) => c.text);
    const forms: BuiltForm[] = [
      {
        familyKey: family.key,
        anchorFormNumber: family.anchorFormNumber,
        isAnchor: true,
        role: 'anchor',
        formNumber: anchor.formNumber,
        title: anchor.title,
        lob: anchor.lob,
        kind: anchor.kind,
        states: anchor.states,
        editionDate: anchor.editionDate,
        filingStatus: anchor.filingStatus,
        provenance: anchor.provenance ?? 'client',
        sourceText: anchor.sourceText,
      },
    ];
    const markers: FamilyMarker[] = [];
    for (const spec of family.variants) {
      forms.push({
        familyKey: family.key,
        anchorFormNumber: family.anchorFormNumber,
        isAnchor: false,
        role: spec.role,
        formNumber: spec.formNumber,
        title: spec.title ?? anchor.title,
        lob: family.lob,
        kind: family.kind,
        states: spec.states,
        editionDate: spec.editionDate,
        filingStatus: spec.filingStatus,
        provenance: spec.provenance ?? 'client',
        sourceText: buildVariantSourceText(anchorClauseTexts, spec),
        note: spec.note,
      });
      // Recipe → explicit findings markers.
      for (const [idxStr, op] of Object.entries(spec.ops ?? {})) {
        const idx = Number(idxStr);
        const heading = anchorHeadingAt(anchor.sourceText, idx);
        if (op.kind === 'limit') {
          markers.push({
            kind: 'materially-divergent',
            familyKey: family.key,
            formNumber: spec.formNumber,
            anchorFormNumber: family.anchorFormNumber,
            clauseHeading: heading,
            detail: spec.note ?? 'limit / notice period changed versus the anchor edition',
            confidence: 0.83,
          });
        } else if (op.kind === 'drop') {
          markers.push({
            kind: 'missing-clause',
            familyKey: family.key,
            formNumber: spec.formNumber,
            anchorFormNumber: family.anchorFormNumber,
            clauseHeading: heading,
            presentIn: forms
              .filter((f) => f.formNumber !== spec.formNumber)
              .map((f) => f.formNumber),
            // Sub-0.70 on purpose → routes to the needs-human queue.
            confidence: 0.66,
          });
        }
      }
    }
    built.push({ family, anchor, forms, markers });
  }
  return built;
}
