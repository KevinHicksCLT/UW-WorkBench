// ── Specimen corpus loader (SCRUM-229) ──
// The eleven uploaded example forms (documents/forms/form_examples +
// synthetic_form_corpus) — fictional carriers, text extracted verbatim from
// the specimen PDFs into backend/data/forms/specimen-corpus.json. They ingest
// through the same segmentation pipeline as every other library form.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = resolve(here, '../../../data/forms/specimen-corpus.json');

export type Specimen = {
  formNumber: string;
  title: string;
  lob: string;
  documentType: string; // Declarations Page | Policy Form | Coverage Form | Endorsement | Contract Form | Rider
  carrier: string; // fictional carrier archetype label
  editionDate: string;
  states: string[] | null;
  filingStatus: string;
  provenance: string;
  sourceFile: string; // original specimen PDF filename
  sourceText: string;
};

let cache: { specimens: Specimen[] } | null = null;

export function loadSpecimens(): Specimen[] {
  if (!cache) {
    cache = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
  }
  return cache!.specimens;
}
