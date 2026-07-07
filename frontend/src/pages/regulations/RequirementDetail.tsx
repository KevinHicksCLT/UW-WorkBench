import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { can } from '../../lib/permissions';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import {
  LinkChips,
  LinksEditor,
  type VsLink,
  type VsOption,
} from '../../components/RequirementLinks';
import { ErrorMessage, LoadingState, StatusPill } from '../../components/ui';
import { catLabel, CONFIDENCE_HELP, OBLIGATION_HELP, type Overview } from './Regulations';

// Single-regulation page — /regulations/requirement/:id. The full record
// behind one table row: obligation text, classification pills, citation,
// owner/contributors, value-stream links (editable), related bulletins, and
// the Work Library plan link.

type RoleRef = { id: string; name: string };
type Requirement = {
  id: string;
  category: string;
  title: string;
  requirement: string;
  lineOfBusiness: string;
  citation: string | null;
  citationUrl: string | null;
  obligationType: string;
  frequency: string | null;
  status: string;
  confidence: string;
  regime: string | null;
  sourceNote: string | null;
  agentSkill: string | null;
  effectiveDate: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
  jurisdiction: {
    id: string;
    code: string;
    name: string;
    regulatorName: string;
    regulatorWebsite: string | null;
    priorityTier: string;
    regulatorType: string;
  };
  bulletins: {
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    url: string | null;
    issuedDate: string | null;
  }[];
  valueStreamLinks: VsLink[];
  owner: RoleRef | null;
  contributors: RoleRef[];
};

const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : null);

export default function RequirementDetail() {
  const { id } = useParams();
  const { permissions } = useAuth();
  const { companyId } = useCompany();
  const canEdit = can(permissions, 'regulations', 'update');
  const [editing, setEditing] = useState(false);

  const req = useApi<Requirement>(
    companyId && id ? withCompany(`/regulations/requirements/${id}`, companyId) : null,
  );
  const overview = useApi<Overview & { valueStreams?: VsOption[] }>(
    companyId ? withCompany('/regulations/overview', companyId) : null,
  );
  const [links, setLinks] = useState<VsLink[] | null>(null);

  if (req.error) {
    return (
      <div>
        <PageHeader title="Regulations" />
        <ErrorMessage>
          {req.error === 'Not found' ? 'No regulation found for this id.' : req.error}
        </ErrorMessage>
        <Link to="/regulations" className="text-sm text-[#4338ca] underline">
          Back to Regulations
        </Link>
      </div>
    );
  }
  if (req.loading || !req.data) return <LoadingState />;
  const r = req.data;
  const vsLinks = links ?? r.valueStreamLinks;

  return (
    <div>
      <PageHeader
        eyebrow={`Regulations · ${r.jurisdiction.name}`}
        title={r.title}
        subtitle={r.jurisdiction.regulatorName + (r.regime ? ` · ${r.regime}` : '')}
        actions={
          <div className="flex items-center gap-2">
            {r.citationUrl && (
              <a
                href={r.citationUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
              >
                Citation source ↗
              </a>
            )}
            <Link
              to={`/regulations/${r.jurisdiction.code}`}
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              {r.jurisdiction.name} page
            </Link>
            <Link
              to={`/work-library?type=regulation&id=${r.id}`}
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              Plan ↗
            </Link>
          </div>
        }
      />

      {/* Classification strip */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-6 text-xs text-[#666666]">
        <StatusPill tone="slate">{catLabel(r.category)}</StatusPill>
        <StatusPill tone="slate">
          {r.lineOfBusiness === 'ALL' ? 'All lines' : label(r.lineOfBusiness)}
        </StatusPill>
        <StatusPill
          tone={r.obligationType === 'FILING_GATE' ? 'amber' : 'blue'}
          title={OBLIGATION_HELP[r.obligationType]}
        >
          {label(r.obligationType)}
        </StatusPill>
        <StatusPill
          tone={r.confidence === 'VERIFIED' ? 'green' : r.confidence === 'STALE' ? 'red' : 'slate'}
          title={CONFIDENCE_HELP[r.confidence]}
        >
          {label(r.confidence)}
        </StatusPill>
        {r.status !== 'ACTIVE' && <StatusPill tone="red">{label(r.status)}</StatusPill>}
        <span className="text-[#a3a3a3]">
          {r.frequency && `Frequency: ${r.frequency} · `}
          {r.effectiveDate && `Effective ${fmtDate(r.effectiveDate)} · `}
          {r.lastVerifiedAt && `Verified ${fmtDate(r.lastVerifiedAt)} · `}
          Updated {fmtDate(r.updatedAt)}
        </span>
      </div>

      <div className="space-y-5">
        <SectionCard title="Requirement">
          <p className="text-sm text-[#525252] leading-relaxed">{r.requirement}</p>
          <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-[#a3a3a3]">
            {r.citation && <span>Citation: {r.citation}</span>}
            {r.sourceNote && <span>Source: {r.sourceNote}</span>}
            {r.agentSkill && <span>Agent skill: {r.agentSkill}</span>}
          </div>
        </SectionCard>

        <SectionCard title="Accountability">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-xs text-[#a3a3a3]">Owner</span>{' '}
              <span className="text-[#171717] font-medium">{r.owner?.name ?? '—'}</span>
            </span>
            <span>
              <span className="text-xs text-[#a3a3a3]">Contributors</span>{' '}
              <span className="text-[#525252]">
                {r.contributors.length ? r.contributors.map((c) => c.name).join(', ') : '—'}
              </span>
            </span>
          </div>
        </SectionCard>

        <SectionCard title={`Value streams (${vsLinks.length})`}>
          <p className="text-xs text-[#a3a3a3] mb-2">
            The value streams whose tasks this regulation governs. Linking applies the obligation to
            every task under the stream; higher-level views roll up from those task links.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <LinkChips links={vsLinks} />
            {canEdit && (
              <button
                onClick={() => setEditing(!editing)}
                className="text-[11px] text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4] transition-colors duration-100"
              >
                {editing ? 'close' : 'edit links'}
              </button>
            )}
          </div>
          {editing && (
            <LinksEditor
              requirementId={r.id}
              links={vsLinks}
              valueStreams={overview.data?.valueStreams ?? []}
              onSaved={(saved) => {
                setLinks(saved);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
        </SectionCard>

        {r.bulletins.length > 0 && (
          <SectionCard title={`Related bulletins (${r.bulletins.length})`}>
            <div className="divide-y divide-[#f5f5f5]">
              {r.bulletins.map((b) => (
                <div key={b.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#171717]">
                      {b.url ? (
                        <a
                          className="hover:underline"
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {b.reference} ↗
                        </a>
                      ) : (
                        b.reference
                      )}
                    </span>
                    {b.issuedDate && (
                      <span className="text-xs text-[#a3a3a3] tnum">{fmtDate(b.issuedDate)}</span>
                    )}
                  </div>
                  {b.summary && <p className="text-xs text-[#525252] mt-0.5">{b.summary}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
