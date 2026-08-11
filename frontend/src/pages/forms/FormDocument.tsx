import { useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { ErrorMessage, LoadingState, StatusPill, type PillTone } from '../../components/ui';
import type { FormDetail } from './types';

// Form document view — renders the actual form (the latest version's canonical
// text) as a specimen-styled paper document. Every library form is clickable
// to here from the Forms library, the workspace Products grid and the Product
// Model tabs; the PolicyForm library is the single source of the content.

const FILING_TONE: Record<string, PillTone> = {
  Draft: 'slate',
  Filed: 'blue',
  Approved: 'green',
  Withdrawn: 'red',
};

/** ALL-CAPS line = section heading (same grammar the clause segmenter uses). */
const HEADING = /^(SECTION [IVXLC0-9].*|[A-Z][A-Z0-9 ,&'()\-—–./]{3,80}\.?)$/;
/** Lettered / numbered enumeration starts render with a hanging indent. */
const ENUMERATED = /^([A-Z]\.|\d{1,2}\.|\([a-z]\))\s/;

function DocumentBody({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (i === 0) {
          return (
            <div key={i} className="text-center text-[15px] font-bold tracking-wide pb-2">
              {trimmed}
            </div>
          );
        }
        if (HEADING.test(trimmed)) {
          return (
            <div key={i} className="pt-3 text-[12px] font-bold tracking-[0.06em] text-[#171717]">
              {trimmed}
            </div>
          );
        }
        if (ENUMERATED.test(trimmed)) {
          return (
            <p key={i} className="pl-5 -indent-4 text-[13px] leading-relaxed text-[#262626]">
              {trimmed}
            </p>
          );
        }
        return (
          <p key={i} className="text-[13px] leading-relaxed text-[#262626]">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default function FormDocument() {
  const { id } = useParams<{ id: string }>();
  const { data: form, error, loading } = useApi<FormDetail>(`/forms/${id}`);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (loading || !form) return <LoadingState message="Loading form document…" />;

  const stamp = `${form.formNumber}${form.editionDate ? ` (${form.editionDate})` : ''}`;
  const states = form.states && form.states.length > 0 ? form.states.join(', ') : 'Countrywide';

  return (
    <div>
      <PageHeader
        title={`${form.formNumber} — ${form.title}`}
        subtitle={`${form.lob ?? 'Policy form'} · ${states}${form.latestVersion ? ` · v${form.latestVersion.versionNo}` : ''}`}
        actions={
          <StatusPill tone={FILING_TONE[form.filingStatus] ?? 'slate'}>
            {form.filingStatus}
          </StatusPill>
        }
      />

      {form.latestSourceText ? (
        <div className="max-w-[880px]">
          <div className="rounded-lg border border-[#e5e5e5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#eaeaea] px-6 py-2.5">
              <span className="text-[11px] font-medium text-[#737373]">{stamp}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                Specimen — synthetic library document, not a filed carrier form
              </span>
            </div>
            <div className="px-8 py-6 font-serif">
              <DocumentBody text={form.latestSourceText} />
            </div>
            <div className="flex items-center justify-between border-t border-[#eaeaea] px-6 py-2.5">
              <span className="text-[11px] text-[#a3a3a3]">{stamp}</span>
              {form.provenance === 'iso-flagged' ? (
                <StatusPill tone="amber">ISO-flagged</StatusPill>
              ) : (
                <span className="text-[11px] text-[#a3a3a3]">
                  {form.ownerRole ? `Owner: ${form.ownerRole.displayValue}` : 'Client-owned'}
                </span>
              )}
            </div>
          </div>
          {form.latestSourceUri && (
            <p className="mt-2 text-[11px] text-[#a3a3a3]">Source: {form.latestSourceUri}</p>
          )}
        </div>
      ) : (
        <ErrorMessage>
          This form has no ingested version yet — ingest its text from the Forms library to render
          the document.
        </ErrorMessage>
      )}
    </div>
  );
}
