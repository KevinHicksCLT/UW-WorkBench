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
import { ErrorMessage, LoadingState } from '../../components/ui';
import {
  catLabel,
  CATEGORY_HELP,
  CONFIDENCE_HELP,
  LOB_HELP,
  OBLIGATION_HELP,
  type Overview,
} from './Regulations';

// Requirement page — /regulations/requirement/:id. The full record behind one
// table row: requirement text, classification (each facet with its
// definition), accountability, value-stream links (editable), the Work
// Library checklist / testing plan, and related bulletins.

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

// Work Library plan shape (GET /work-library/plan/regulation/:id) — the same
// endpoint the Work Library page consumes, so both screens always agree.
type PlanAnswer = { id: string; value: string | null; suppressed?: boolean } | null;
type PlanSection = {
  id: string;
  kind: string; // CHECKLIST | TEST
  name: string;
  description: string | null;
  keys: { id: string; key: string; guidance: string | null; answer: PlanAnswer }[];
};
type Plan = {
  sections: PlanSection[];
  customRows: { id: string; kind: string; customKey: string | null; value: string | null }[];
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
  const plan = useApi<Plan>(id ? `/work-library/plan/regulation/${id}` : null);
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

      <div className="space-y-5">
        <SectionCard title="Requirement">
          <p className="text-sm text-[#525252] leading-relaxed">{r.requirement}</p>
          <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-[#a3a3a3]">
            {r.citation && <span>Citation: {r.citation}</span>}
            {r.sourceNote && <span>Source: {r.sourceNote}</span>}
            {r.agentSkill && <span>Agent skill: {r.agentSkill}</span>}
          </div>
        </SectionCard>

        {/* Each classification facet with its definition — the answer to "what
            do Financial reporting / All lines / Filing gate / Baseline mean". */}
        <SectionCard title="Classification">
          <div className="space-y-2">
            {r.regime && (
              <ClassRow
                name="Regulation"
                value={
                  <Link
                    to={`/regulations/regulation/${encodeURIComponent(r.regime)}`}
                    className="hover:underline text-[#2563eb]"
                  >
                    {r.regime}
                  </Link>
                }
                help="The named regulation this requirement belongs to — click to see all of its requirements"
              />
            )}
            <ClassRow
              name="Category"
              value={catLabel(r.category)}
              help={
                CATEGORY_HELP[r.category] ?? 'Compliance domain used for grouping and filtering'
              }
            />
            <ClassRow
              name="Line of business"
              value={r.lineOfBusiness === 'ALL' ? 'All lines' : label(r.lineOfBusiness)}
              help={LOB_HELP[r.lineOfBusiness] ?? 'The insurance line this requirement applies to'}
            />
            <ClassRow
              name="Type"
              value={label(r.obligationType)}
              help={OBLIGATION_HELP[r.obligationType] ?? ''}
            />
            <ClassRow
              name="Confidence"
              value={label(r.confidence)}
              help={CONFIDENCE_HELP[r.confidence] ?? ''}
            />
            {r.frequency && (
              <ClassRow
                name="Frequency"
                value={r.frequency}
                help="How often the obligation recurs"
              />
            )}
            {r.status !== 'ACTIVE' && (
              <ClassRow name="Status" value={label(r.status)} help="Not currently in force" />
            )}
          </div>
          <div className="mt-3 text-xs text-[#a3a3a3]">
            {r.effectiveDate && `Effective ${fmtDate(r.effectiveDate)} · `}
            {r.lastVerifiedAt && `Verified ${fmtDate(r.lastVerifiedAt)} · `}
            Updated {fmtDate(r.updatedAt)}
          </div>
        </SectionCard>

        <SectionCard title="Accountability">
          <div className="text-sm">
            <div>
              <span className="text-xs text-[#a3a3a3]">Owner</span>{' '}
              <span className="text-[#171717] font-medium">{r.owner?.name ?? '—'}</span>
            </div>
            <div className="mt-2">
              <div className="text-xs text-[#a3a3a3]">Contributors</div>
              {r.contributors.length ? (
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {r.contributors.map((c) => (
                    <li key={c.id} className="text-[#525252]">
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[#525252]">—</span>
              )}
            </div>
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

        {/* Checklist + testing plan — read straight from the Work Library plan
            endpoint (single source of truth; edits happen in the Work Library). */}
        <SectionCard title="Compliance plan">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#a3a3a3]">
              Checklist and testing plan for this requirement, from the Work Library.
            </p>
            <Link
              to={`/work-library?type=regulation&id=${r.id}`}
              className="text-[11.5px] font-medium text-[#2563eb] hover:underline flex-shrink-0"
            >
              Open in Work Library ↗
            </Link>
          </div>
          {plan.loading && <LoadingState />}
          {!plan.loading && <PlanSections plan={plan.data} />}
        </SectionCard>

        {r.bulletins.length > 0 && (
          <SectionCard title={`Related bulletins (${r.bulletins.length})`}>
            <p className="text-xs text-[#a3a3a3] mb-2">
              Bulletins are official notices the regulator publishes to interpret or announce
              requirements — these reference this one.
            </p>
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

/** One classification facet — name, value, and what it means. */
function ClassRow({ name, value, help }: { name: string; value: React.ReactNode; help: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-32 flex-shrink-0 text-xs text-[#a3a3a3]">{name}</span>
      <span className="w-40 flex-shrink-0 font-medium text-[#171717]">{value}</span>
      <span className="text-xs text-[#525252]">{help}</span>
    </div>
  );
}

/** Read-only render of the Work Library plan (checklist + testing sections). */
function PlanSections({ plan }: { plan: Plan | null }) {
  const sections = plan?.sections ?? [];
  const custom = plan?.customRows ?? [];
  if (!sections.length && !custom.length) {
    return (
      <p className="text-sm text-[#a3a3a3]">
        No checklist or testing template assigned yet — assign one in the Work Library.
      </p>
    );
  }
  const kindTitle = (k: string) => (k === 'CHECKLIST' ? 'Checklist' : 'Testing template');
  const customFor = (k: string) => custom.filter((c) => c.kind === k && c.customKey);
  const kinds = [...new Set([...sections.map((s) => s.kind), ...custom.map((c) => c.kind)])];
  return (
    <div className="space-y-4">
      {kinds.map((kind) => (
        <div key={kind}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] mb-1.5">
            {kindTitle(kind)}
          </div>
          {sections
            .filter((s) => s.kind === kind)
            .map((s) => (
              <ul key={s.id} className="list-disc pl-5 space-y-1">
                {s.keys
                  .filter((k) => !k.answer?.suppressed)
                  .map((k) => (
                    <li key={k.id} className="text-sm text-[#525252]">
                      <span className="text-[#262626]">{k.key}</span>
                      {k.answer?.value && (
                        <span className="text-[#525252]"> — {k.answer.value}</span>
                      )}
                      {!k.answer?.value && k.guidance && (
                        <span className="text-[#a3a3a3]"> — {k.guidance}</span>
                      )}
                    </li>
                  ))}
              </ul>
            ))}
          {customFor(kind).length > 0 && (
            <ul className="list-disc pl-5 space-y-1 mt-1">
              {customFor(kind).map((c) => (
                <li key={c.id} className="text-sm text-[#525252]">
                  <span className="text-[#262626]">{c.customKey}</span>
                  {c.value && <span> — {c.value}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
