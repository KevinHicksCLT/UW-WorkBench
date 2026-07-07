import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { can } from '../../lib/permissions';
import { useCompany } from '../../lib/company';
import { withCompany, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import AssistantMarkdown from '../../components/AssistantMarkdown';
import {
  LinkChips,
  LinksEditor,
  type VsLink,
  type VsOption,
} from '../../components/RequirementLinks';
import { FlagPill, catLabel, CONFIDENCE_HELP, OBLIGATION_HELP } from '../regulations/Regulations';
import { EmptyState, ErrorMessage, LoadingState, StatusPill } from '../../components/ui';

// State detail — /regulations/:code. Regulator identity + taxonomy flags in the
// header; sections for the compliance profile (FULL_PROFILE states), the
// requirement list (with the inline value-stream link editor), integration
// systems, bulletins, machine-readable compliance rules, and monitored sources.

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
  valueStreamLinks: VsLink[];
  owner: RoleRef | null;
  contributors: RoleRef[];
};
type Detail = {
  id: string;
  code: string;
  name: string;
  regulatorType: string;
  regulatorName: string;
  regulatorWebsite: string | null;
  filingPortal: string;
  filingPortalDetail: string | null;
  compactStatus: string;
  autoVerification: string;
  autoVerificationDetail: string | null;
  workersCompModel: string;
  workersCompDetail: string | null;
  apcd: string;
  sbs: string;
  statutoryAuthority: string | null;
  summaryRegulator: string | null;
  summaryStatutes: string | null;
  summaryIntegration: string | null;
  executiveSummary: string | null;
  operatingModel: string | null;
  priorityTier: string;
  profileDepth: string;
  lastReviewedAt: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
  requirements: Requirement[];
  integrations: {
    id: string;
    usage: string;
    scope: string;
    notes: string | null;
    system: {
      id: string;
      name: string;
      kind: string;
      operator: string;
      website: string | null;
      description: string | null;
    };
  }[];
  bulletins: {
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    url: string | null;
    issuedDate: string | null;
    discoveredVia: string;
  }[];
  rules: {
    id: string;
    ruleCode: string;
    category: string;
    description: string | null;
    ruleJson: unknown;
    origin: string;
    active: boolean;
  }[];
  sources: {
    id: string;
    name: string;
    url: string;
    sourceType: string;
    authority: string;
    monitor: boolean;
    checkTier: string;
    healthStatus: string;
  }[];
};

const USAGE_PILL: Record<string, string> = {
  REQUIRED: 'pill-green',
  ACCEPTED: 'pill-blue',
  TRANSITIONING: 'pill-amber',
  NOT_USED: 'pill-slate',
};
const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export default function RegulationDetail() {
  const { code } = useParams();
  const { permissions } = useAuth();
  const { companyId } = useCompany();
  const canEdit = can(permissions, 'regulations', 'update');

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [valueStreams, setValueStreams] = useState<VsOption[]>([]);

  useEffect(() => {
    if (!companyId || !code) return;
    api
      .get<Detail>(withCompany(`/regulations/jurisdictions/${code}`, companyId))
      .then(setDetail)
      .catch((e) => setError(e.message));
    api
      .get<{ valueStreams?: VsOption[] }>(withCompany('/regulations/overview', companyId))
      .then((o) => setValueStreams(o.valueStreams ?? []))
      .catch(() => {});
  }, [companyId, code]);

  if (error) {
    return (
      <div>
        <PageHeader title="Regulations" />
        <ErrorMessage>
          {error === 'Not found' ? `No jurisdiction "${code}" found.` : error}
        </ErrorMessage>
        <Link to="/regulations" className="text-sm text-[#4338ca] underline">
          Back to Regulations
        </Link>
      </div>
    );
  }
  if (!detail) return <LoadingState />;

  const patchLinks = (id: string, links: VsLink[]) =>
    setDetail(
      (prev) =>
        prev && {
          ...prev,
          requirements: prev.requirements.map((r) =>
            r.id === id ? { ...r, valueStreamLinks: links } : r,
          ),
        },
    );

  // Federal / national regulators carry no state taxonomy flags or state-only
  // sections (integrations, bulletins, rules, monitored sources) — hide them.
  const isFederal = detail.regulatorType === 'FEDERAL_SECURITIES';

  return (
    <div>
      <PageHeader
        eyebrow="Regulations"
        title={detail.name}
        subtitle={
          detail.regulatorName +
          (detail.statutoryAuthority ? ` · ${detail.statutoryAuthority}` : '')
        }
        actions={
          <div className="flex items-center gap-2">
            {detail.regulatorWebsite && (
              <a
                href={detail.regulatorWebsite}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
              >
                Regulator site ↗
              </a>
            )}
            <Link
              to="/regulations"
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              {isFederal ? 'All regulations' : 'All states'}
            </Link>
          </div>
        }
      />

      {/* Flag strip — state taxonomy flags (states only). */}
      {isFederal ? (
        detail.summaryRegulator && (
          <div className="mb-6 text-sm text-[#525252] leading-relaxed">
            {detail.summaryRegulator}
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-xs text-[#666666]">
          {detail.priorityTier === 'PRIORITY' && (
            <StatusPill tone="amber">Priority state</StatusPill>
          )}
          {detail.profileDepth === 'FULL_PROFILE' && (
            <StatusPill tone="blue">Full compliance profile</StatusPill>
          )}
          <span className="flex items-center gap-1.5">
            Filing portal{' '}
            <FlagPill value={detail.filingPortal} detail={detail.filingPortalDetail} />
          </span>
          <span className="flex items-center gap-1.5">
            Compact <FlagPill value={detail.compactStatus} />
          </span>
          <span className="flex items-center gap-1.5">
            Auto verify{' '}
            <FlagPill value={detail.autoVerification} detail={detail.autoVerificationDetail} />
          </span>
          <span className="flex items-center gap-1.5">
            Workers' comp{' '}
            <FlagPill value={detail.workersCompModel} detail={detail.workersCompDetail} />
          </span>
          <span className="flex items-center gap-1.5">
            APCD <FlagPill value={detail.apcd} />
          </span>
          <span className="flex items-center gap-1.5">
            SBS <FlagPill value={detail.sbs} />
          </span>
          {/* Verification metadata lives here on the state view (SCRUM-76) —
              the aggregate table stays free of per-row dates and numbers. */}
          <span
            className="text-[#a3a3a3]"
            title="Verified = profile confirmed against the regulator's official sources; Reviewed = last analyst pass; Updated = last data change"
          >
            {detail.lastVerifiedAt &&
              `Verified ${new Date(detail.lastVerifiedAt).toLocaleDateString()} · `}
            {detail.lastReviewedAt &&
              `Reviewed ${new Date(detail.lastReviewedAt).toLocaleDateString()} · `}
            Updated {new Date(detail.updatedAt).toLocaleDateString()}
          </span>
        </div>
      )}

      <div className="space-y-5">
        {detail.executiveSummary && (
          <SectionCard title="Executive summary">
            <AssistantMarkdown content={detail.executiveSummary} />
            {detail.operatingModel && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-[#666666] cursor-pointer hover:text-[#171717]">
                  Operating model detail
                </summary>
                <div className="mt-2">
                  <AssistantMarkdown content={detail.operatingModel} />
                </div>
              </details>
            )}
          </SectionCard>
        )}

        <SectionCard title={`Requirements (${detail.requirements.length})`}>
          <div className="divide-y divide-[#f5f5f5]">
            {detail.requirements.map((r) => (
              <div key={r.id} className="py-2.5">
                <Link
                  to={`/regulations/requirement/${r.id}`}
                  className="text-sm font-medium text-[#171717] hover:underline"
                >
                  {r.title}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {r.regime && (
                    <Link to={`/regulations/regulation/${encodeURIComponent(r.regime)}`}>
                      <StatusPill
                        tone="blue"
                        className="hover:underline"
                        title="Open regulation page"
                      >
                        {r.regime}
                      </StatusPill>
                    </Link>
                  )}
                  <StatusPill tone="slate">{catLabel(r.category)}</StatusPill>
                  {r.lineOfBusiness !== 'ALL' && (
                    <StatusPill tone="slate">{label(r.lineOfBusiness)}</StatusPill>
                  )}
                  {r.obligationType === 'FILING_GATE' && (
                    <StatusPill tone="amber" title={OBLIGATION_HELP.FILING_GATE}>
                      Filing gate
                    </StatusPill>
                  )}
                  {r.confidence !== 'BASELINE' && (
                    <StatusPill
                      tone={
                        r.confidence === 'VERIFIED'
                          ? 'green'
                          : r.confidence === 'STALE'
                            ? 'red'
                            : 'amber'
                      }
                      title={CONFIDENCE_HELP[r.confidence]}
                    >
                      {label(r.confidence)}
                    </StatusPill>
                  )}
                  <LinkChips links={r.valueStreamLinks} />
                  {canEdit && (
                    <button
                      onClick={() => setEditing(editing === r.id ? null : r.id)}
                      className="text-[11px] text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4] transition-colors duration-100"
                    >
                      {editing === r.id ? 'close' : 'edit links'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-[#525252] leading-relaxed mt-1.5">{r.requirement}</p>
                <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-[#a3a3a3]">
                  {r.owner && (
                    <span>
                      Owner: <span className="text-[#525252]">{r.owner.name}</span>
                    </span>
                  )}
                  {r.contributors.length > 0 && (
                    <span>
                      Contributors:{' '}
                      <span className="text-[#525252]">
                        {r.contributors.map((c) => c.name).join(', ')}
                      </span>
                    </span>
                  )}
                  {r.citation && <span>Citation: {r.citation}</span>}
                  {r.frequency && <span>Frequency: {r.frequency}</span>}
                </div>
                {editing === r.id && (
                  <>
                    {/* What editing applicability actually does (SCRUM-40). */}
                    <p className="text-[11px] text-[#a3a3a3] mt-2 leading-relaxed">
                      Linking a value stream applies this regulation to every task under it;
                      removing a link withdraws it. Task lists, the Inspector&apos;s Governance tab,
                      and the coverage rollups all update from those task links.
                    </p>
                    <LinksEditor
                      requirementId={r.id}
                      links={r.valueStreamLinks}
                      valueStreams={valueStreams}
                      onSaved={(links) => {
                        patchLinks(r.id, links);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {!isFederal && (
          <SectionCard title={`Integration & electronic systems (${detail.integrations.length})`}>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] border-b border-[#eaeaea]">
                    <th className="py-2 pr-3">System</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3 text-center">Usage</th>
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.integrations.map((i) => (
                    <tr key={i.id} className="border-b border-[#f5f5f5]">
                      <td
                        className="py-2 pr-3 font-medium text-[#171717]"
                        title={i.system.description ?? undefined}
                      >
                        {i.system.website ? (
                          <a
                            href={i.system.website}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {i.system.name}
                          </a>
                        ) : (
                          i.system.name
                        )}
                      </td>
                      <td className="py-2 pr-3 text-[#525252]">
                        {label(i.system.kind)} · {i.system.operator}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span className={USAGE_PILL[i.usage] ?? 'pill-slate'}>
                          {label(i.usage)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[#525252]">{i.scope}</td>
                      <td className="py-2 text-[#a3a3a3] text-xs">{i.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {detail.summaryIntegration && (
          <SectionCard title="Integration narrative (from the baseline document)">
            <AssistantMarkdown content={detail.summaryIntegration} />
          </SectionCard>
        )}
        {detail.summaryStatutes && (
          <SectionCard title="Statutes & regulations (from the baseline document)">
            <AssistantMarkdown content={detail.summaryStatutes} />
          </SectionCard>
        )}

        {!isFederal && (
          <>
            <SectionCard title={`Bulletins (${detail.bulletins.length})`}>
              <p className="text-xs text-[#a3a3a3] mb-2">
                Official notices this regulator has published — interpreting legislation, announcing
                rate-filing expectations, or setting fees. Captured during the baseline research.
              </p>
              {detail.bulletins.length === 0 && (
                <EmptyState
                  baseClassName="text-sm text-[#a3a3a3]"
                  message="No bulletins on file for this state yet."
                />
              )}
              <div className="divide-y divide-[#f5f5f5]">
                {detail.bulletins.map((b) => (
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
                        <span className="text-xs text-[#a3a3a3] tnum">
                          {new Date(b.issuedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {b.summary && <p className="text-xs text-[#525252] mt-0.5">{b.summary}</p>}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={`Compliance rules (${detail.rules.length})`}>
              <p className="text-xs text-[#a3a3a3] mb-3">
                Machine-readable controls from the per-state rules artifact — distinct from the
                requirements above: a requirement states the legal obligation, a rule encodes a
                checkable control for it. Stored and displayed in Phase 1 — execution against
                operational signals is a future phase.
              </p>
              <div className="divide-y divide-[#f5f5f5]">
                {detail.rules.map((r) => (
                  <div key={r.id} className="py-2">
                    <button
                      className="flex items-center gap-2 w-full text-left"
                      onClick={() => setOpenRule(openRule === r.id ? null : r.id)}
                      aria-expanded={openRule === r.id}
                    >
                      <span className="text-sm font-medium tnum text-[#171717]">{r.ruleCode}</span>
                      <span className="flex-1" />
                      <span className="text-[#a3a3a3] text-xs">
                        {openRule === r.id ? '▾' : '▸'}
                      </span>
                    </button>
                    {r.description && (
                      <p className="text-xs text-[#525252] mt-0.5">{r.description}</p>
                    )}
                    {openRule === r.id && (
                      <pre className="mt-2 rounded-lg bg-[#fafafa] border border-[#eaeaea] p-3 text-[11px] text-[#262626] overflow-x-auto">
                        {JSON.stringify(r.ruleJson, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={`Regulatory sources (${detail.sources.length})`}>
              <p className="text-xs text-[#a3a3a3] mb-2">
                The official sites and feeds this state&apos;s requirements and bulletins come from.
                Automated monitoring is a future phase — nothing is polled today.
              </p>
              <div className="divide-y divide-[#f5f5f5]">
                {detail.sources.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#171717] hover:underline truncate"
                    >
                      {s.name} ↗
                    </a>
                    <StatusPill tone="slate">{label(s.sourceType)}</StatusPill>
                    <StatusPill tone={s.authority === 'OFFICIAL_REGULATOR' ? 'green' : 'blue'}>
                      {label(s.authority)}
                    </StatusPill>
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
